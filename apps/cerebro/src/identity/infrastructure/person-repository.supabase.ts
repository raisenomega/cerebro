/**
 * Adaptador Supabase del PersonRepository. ÚNICO archivo del dominio identidad
 * que toca Supabase. Corre con service_role (BYPASSRLS): ve todas las
 * identidades para unificar cross-plataforma (Arquitectura §5).
 *
 * Las filas de PostgREST llegan sin tipar fuerte hasta que generemos los tipos
 * de la DB (slice posterior); por eso se mapean a través de interfaces `*Row`
 * explícitas en la frontera, sin filtrar `any` al resto del código.
 */
import type { IdType } from "@raisen/cerebro-contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  IdentityLookup,
  NewIdentity,
  PersonRepository,
} from "../domain/person-repository.port.js";
import type { PersonIdentityRecord, PersonRecord } from "../domain/person.types.js";

interface PersonRow {
  readonly id: string;
  readonly display_name: string | null;
  readonly merged_into: string | null;
}

interface IdentityRow {
  readonly id: string;
  readonly person_id: string;
  readonly source_platform: string;
  readonly id_type: string;
  readonly id_value: string;
  readonly id_normalized: string;
  readonly confidence: number | string;
}

const PERSON_COLS = "id, display_name, merged_into";
const IDENTITY_COLS = "id, person_id, source_platform, id_type, id_value, id_normalized, confidence";

export class SupabasePersonRepository implements PersonRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findIdentity(lookup: IdentityLookup): Promise<PersonIdentityRecord | null> {
    let query = this.db
      .from("person_identity")
      .select(IDENTITY_COLS)
      .eq("id_type", lookup.id_type)
      .eq("id_normalized", lookup.id_normalized);
    if (lookup.source_platform !== undefined) {
      query = query.eq("source_platform", lookup.source_platform);
    }
    const { data, error } = await query.order("created_at", { ascending: true }).limit(1);
    if (error !== null) throw new Error(`findIdentity: ${error.message}`);
    const row = asRows<IdentityRow>(data)[0];
    return row === undefined ? null : toIdentity(row);
  }

  async getPerson(personId: string): Promise<PersonRecord | null> {
    const { data, error } = await this.db
      .from("person")
      .select(PERSON_COLS)
      .eq("id", personId)
      .limit(1);
    if (error !== null) throw new Error(`getPerson: ${error.message}`);
    const row = asRows<PersonRow>(data)[0];
    return row === undefined ? null : toPerson(row);
  }

  async createPerson(displayName: string | null): Promise<PersonRecord> {
    const { data, error } = await this.db
      .from("person")
      .insert({ display_name: displayName })
      .select(PERSON_COLS)
      .limit(1);
    if (error !== null) throw new Error(`createPerson: ${error.message}`);
    const row = asRows<PersonRow>(data)[0];
    if (row === undefined) throw new Error("createPerson: el insert no devolvió fila");
    return toPerson(row);
  }

  async insertIdentity(identity: NewIdentity): Promise<PersonIdentityRecord> {
    // INSERT ... ON CONFLICT DO NOTHING (idempotente, NO sobrescribe person_id).
    const inserted = await this.db
      .from("person_identity")
      .upsert(
        {
          person_id: identity.person_id,
          source_platform: identity.source_platform,
          id_type: identity.id_type,
          id_value: identity.id_value,
          id_normalized: identity.id_normalized,
          confidence: identity.confidence,
        },
        { onConflict: "source_platform,id_type,id_normalized", ignoreDuplicates: true },
      )
      .select(IDENTITY_COLS)
      .limit(1);
    if (inserted.error !== null) throw new Error(`insertIdentity(insert): ${inserted.error.message}`);
    const insertedRow = asRows<IdentityRow>(inserted.data)[0];
    if (insertedRow !== undefined) return toIdentity(insertedRow);

    // Conflicto: la fila ya existía -> devolverla (idempotencia).
    const existing = await this.db
      .from("person_identity")
      .select(IDENTITY_COLS)
      .eq("source_platform", identity.source_platform)
      .eq("id_type", identity.id_type)
      .eq("id_normalized", identity.id_normalized)
      .limit(1);
    if (existing.error !== null) throw new Error(`insertIdentity(reselect): ${existing.error.message}`);
    const existingRow = asRows<IdentityRow>(existing.data)[0];
    if (existingRow === undefined) throw new Error("insertIdentity: ni insertó ni encontró la fila");
    return toIdentity(existingRow);
  }

  async mergePersons(survivorId: string, absorbedId: string): Promise<void> {
    const repoint = await this.db
      .from("person_identity")
      .update({ person_id: survivorId })
      .eq("person_id", absorbedId);
    if (repoint.error !== null) throw new Error(`mergePersons(repoint): ${repoint.error.message}`);
    const mark = await this.db
      .from("person")
      .update({ merged_into: survivorId })
      .eq("id", absorbedId);
    if (mark.error !== null) throw new Error(`mergePersons(mark): ${mark.error.message}`);
  }
}

/** Frontera de tipos: PostgREST devuelve filas sin tipar hasta generar tipos de DB. */
function asRows<T>(data: unknown): readonly T[] {
  return Array.isArray(data) ? (data as readonly T[]) : [];
}

function toPerson(row: PersonRow): PersonRecord {
  return { id: row.id, display_name: row.display_name, merged_into: row.merged_into };
}

function toIdentity(row: IdentityRow): PersonIdentityRecord {
  return {
    id: row.id,
    person_id: row.person_id,
    source_platform: row.source_platform,
    id_type: row.id_type as IdType, // el CHECK de la DB garantiza el dominio
    id_value: row.id_value,
    id_normalized: row.id_normalized,
    confidence: typeof row.confidence === "string" ? Number(row.confidence) : row.confidence,
  };
}
