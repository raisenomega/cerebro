/**
 * Adaptadores Postgres del dominio de identidad. Conexión DIRECTA (no PostgREST)
 * con un rol SIN BYPASSRLS (cerebro_api): la seguridad la aplica la RLS de la
 * base, no el código. Por cada unidad de trabajo se abre una transacción y se
 * fija `SET LOCAL app.current_owner_id`, de modo que RLS aísla todo por owner.
 *
 * ÚNICO lugar que toca `pg`. Las filas se mapean en la frontera vía interfaces
 * `*Row` explícitas (sin filtrar tipos laxos de la DB al resto del código).
 */
import { type Pool, type PoolClient } from "pg";
import type { IdType, PersonId } from "@raisen/cerebro-contracts";
import type {
  IdentityLookup,
  IdentityStore,
  IdentityUnitOfWork,
  NewIdentity,
  OwnerResolver,
} from "../domain/person-repository.port.js";
import type { OwnerId, PersonIdentityRecord, PersonRecord } from "../domain/person.types.js";

interface OwnerIdRow {
  readonly owner_id: string | null;
}
interface PersonRow {
  readonly id: string;
  readonly owner_id: string;
  readonly display_name: string | null;
  readonly merged_into: string | null;
}
interface IdentityRow {
  readonly id: string;
  readonly owner_id: string;
  readonly person_id: string;
  readonly source_platform: string;
  readonly id_type: string;
  readonly id_value: string;
  readonly id_normalized: string;
  readonly confidence: string | number;
}

const PERSON_COLS = "id, owner_id, display_name, merged_into";
const IDENTITY_COLS =
  "id, owner_id, person_id, source_platform, id_type, id_value, id_normalized, confidence";

/** Traducción tenant -> owner vía la función SECURITY DEFINER de la DB. */
export class PgOwnerResolver implements OwnerResolver {
  constructor(private readonly pool: Pool) {}

  async resolveOwnerId(sourcePlatform: string, platformTenantId: string): Promise<OwnerId | null> {
    const res = await this.pool.query<OwnerIdRow>(
      "SELECT cerebro_resolve_owner($1, $2) AS owner_id",
      [sourcePlatform, platformTenantId],
    );
    const row = res.rows[0];
    return row && row.owner_id !== null ? row.owner_id : null;
  }
}

/** Abre tx + fija el contexto de owner (RLS) y ejecuta la unidad de trabajo. */
export class PgIdentityUnitOfWork implements IdentityUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async withOwner<T>(ownerId: OwnerId, fn: (store: IdentityStore) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // SET LOCAL app.current_owner_id (transaction-scoped) -> RLS aísla por owner.
      await client.query("SELECT set_config('app.current_owner_id', $1, true)", [ownerId]);
      const result = await fn(new PgIdentityStore(client));
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await safeRollback(client);
      throw e;
    } finally {
      client.release();
    }
  }
}

async function safeRollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // conexión ya rota: nada que deshacer
  }
}

class PgIdentityStore implements IdentityStore {
  constructor(private readonly client: PoolClient) {}

  async findIdentity(ownerId: OwnerId, lookup: IdentityLookup): Promise<PersonIdentityRecord | null> {
    const res = await this.client.query<IdentityRow>(
      `SELECT ${IDENTITY_COLS} FROM person_identity
       WHERE owner_id = $1 AND id_type = $2 AND id_normalized = $3 LIMIT 1`,
      [ownerId, lookup.id_type, lookup.id_normalized],
    );
    const row = res.rows[0];
    return row === undefined ? null : toIdentity(row);
  }

  async getPerson(ownerId: OwnerId, personId: PersonId): Promise<PersonRecord | null> {
    const res = await this.client.query<PersonRow>(
      `SELECT ${PERSON_COLS} FROM person WHERE owner_id = $1 AND id = $2 LIMIT 1`,
      [ownerId, personId],
    );
    const row = res.rows[0];
    return row === undefined ? null : toPerson(row);
  }

  async createPerson(ownerId: OwnerId, displayName: string | null): Promise<PersonRecord> {
    const res = await this.client.query<PersonRow>(
      `INSERT INTO person (owner_id, display_name) VALUES ($1, $2) RETURNING ${PERSON_COLS}`,
      [ownerId, displayName],
    );
    const row = res.rows[0];
    if (row === undefined) throw new Error("createPerson: el INSERT no devolvió fila");
    return toPerson(row);
  }

  async insertIdentity(identity: NewIdentity): Promise<PersonIdentityRecord> {
    const inserted = await this.client.query<IdentityRow>(
      `INSERT INTO person_identity
         (owner_id, person_id, source_platform, id_type, id_value, id_normalized, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (owner_id, id_type, id_normalized) DO NOTHING
       RETURNING ${IDENTITY_COLS}`,
      [
        identity.owner_id,
        identity.person_id,
        identity.source_platform,
        identity.id_type,
        identity.id_value,
        identity.id_normalized,
        identity.confidence,
      ],
    );
    const insertedRow = inserted.rows[0];
    if (insertedRow !== undefined) return toIdentity(insertedRow);

    // Conflicto: ya existía -> devolver la fila existente (idempotente, misma person).
    const existing = await this.client.query<IdentityRow>(
      `SELECT ${IDENTITY_COLS} FROM person_identity
       WHERE owner_id = $1 AND id_type = $2 AND id_normalized = $3 LIMIT 1`,
      [identity.owner_id, identity.id_type, identity.id_normalized],
    );
    const existingRow = existing.rows[0];
    if (existingRow === undefined) throw new Error("insertIdentity: ni insertó ni encontró la fila");
    return toIdentity(existingRow);
  }

  async mergePersons(ownerId: OwnerId, survivorId: PersonId, absorbedId: PersonId): Promise<void> {
    await this.client.query(
      "UPDATE person_identity SET person_id = $1 WHERE owner_id = $2 AND person_id = $3",
      [survivorId, ownerId, absorbedId],
    );
    await this.client.query(
      "UPDATE person SET merged_into = $1 WHERE owner_id = $2 AND id = $3",
      [survivorId, ownerId, absorbedId],
    );
  }
}

function toPerson(row: PersonRow): PersonRecord {
  return {
    id: row.id,
    owner_id: row.owner_id,
    display_name: row.display_name,
    merged_into: row.merged_into,
  };
}

function toIdentity(row: IdentityRow): PersonIdentityRecord {
  return {
    id: row.id,
    owner_id: row.owner_id,
    person_id: row.person_id,
    source_platform: row.source_platform,
    id_type: row.id_type as IdType, // el CHECK de la DB garantiza el dominio
    id_value: row.id_value,
    id_normalized: row.id_normalized,
    confidence: typeof row.confidence === "string" ? Number(row.confidence) : row.confidence,
  };
}
