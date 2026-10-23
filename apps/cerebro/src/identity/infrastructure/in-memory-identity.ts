/**
 * Adaptadores en memoria del dominio de identidad. Para tests unitarios del
 * resolver (sin DB) y dev local. Replican el comportamiento clave de los
 * adaptadores Postgres, incluido el aislamiento por owner (que en la DB real
 * aplica la RLS; aquí se filtra explícitamente por owner_id en cada op).
 */
import { randomUUID } from "node:crypto";
import type {
  IdentityLookup,
  IdentityStore,
  IdentityUnitOfWork,
  NewIdentity,
  OwnerResolver,
} from "../domain/person-repository.port.js";
import type { OwnerId, PersonIdentityRecord, PersonRecord } from "../domain/person.types.js";

function tenantKey(sourcePlatform: string, tenantId: string): string {
  return `${sourcePlatform}\u0000${tenantId}`;
}

/** OwnerResolver en memoria. Registra mapeos (source_platform, tenant_id) -> owner. */
export class InMemoryOwnerResolver implements OwnerResolver {
  private readonly map = new Map<string, OwnerId>();

  register(sourcePlatform: string, tenantId: string, ownerId: OwnerId): this {
    this.map.set(tenantKey(sourcePlatform, tenantId), ownerId);
    return this;
  }

  async resolveOwnerId(sourcePlatform: string, platformTenantId: string): Promise<OwnerId | null> {
    return this.map.get(tenantKey(sourcePlatform, platformTenantId)) ?? null;
  }
}

/** Store en memoria, aislado por owner_id (simula la RLS). */
export class InMemoryIdentityStore implements IdentityStore {
  private readonly persons = new Map<string, PersonRecord>();
  private readonly identities: PersonIdentityRecord[] = [];

  async findIdentity(ownerId: OwnerId, lookup: IdentityLookup): Promise<PersonIdentityRecord | null> {
    const match = this.identities.find(
      (i) =>
        i.owner_id === ownerId &&
        i.id_type === lookup.id_type &&
        i.id_normalized === lookup.id_normalized,
    );
    return match ?? null;
  }

  async getPerson(ownerId: OwnerId, personId: string): Promise<PersonRecord | null> {
    const person = this.persons.get(personId);
    return person !== undefined && person.owner_id === ownerId ? person : null;
  }

  async createPerson(ownerId: OwnerId, displayName: string | null): Promise<PersonRecord> {
    const person: PersonRecord = {
      id: randomUUID(),
      owner_id: ownerId,
      display_name: displayName,
      merged_into: null,
    };
    this.persons.set(person.id, person);
    return person;
  }

  async insertIdentity(identity: NewIdentity): Promise<PersonIdentityRecord> {
    const existing = this.identities.find(
      (i) =>
        i.owner_id === identity.owner_id &&
        i.id_type === identity.id_type &&
        i.id_normalized === identity.id_normalized,
    );
    if (existing !== undefined) return existing; // idempotente (UNIQUE owner,id_type,normalized)

    const row: PersonIdentityRecord = {
      id: randomUUID(),
      owner_id: identity.owner_id,
      person_id: identity.person_id,
      source_platform: identity.source_platform,
      id_type: identity.id_type,
      id_value: identity.id_value,
      id_normalized: identity.id_normalized,
      confidence: identity.confidence,
    };
    this.identities.push(row);
    return row;
  }

  async mergePersons(ownerId: OwnerId, survivorId: string, absorbedId: string): Promise<void> {
    for (let idx = 0; idx < this.identities.length; idx++) {
      const row = this.identities[idx];
      if (row !== undefined && row.owner_id === ownerId && row.person_id === absorbedId) {
        this.identities[idx] = { ...row, person_id: survivorId };
      }
    }
    const absorbed = this.persons.get(absorbedId);
    if (absorbed !== undefined && absorbed.owner_id === ownerId) {
      this.persons.set(absorbedId, { ...absorbed, merged_into: survivorId });
    }
  }
}

/** UoW en memoria: comparte un único store; no hay transacción/contexto real. */
export class InMemoryIdentityUnitOfWork implements IdentityUnitOfWork {
  constructor(private readonly store: InMemoryIdentityStore = new InMemoryIdentityStore()) {}

  async withOwner<T>(_ownerId: OwnerId, fn: (store: IdentityStore) => Promise<T>): Promise<T> {
    return fn(this.store);
  }
}
