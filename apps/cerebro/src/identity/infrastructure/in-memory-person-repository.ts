/**
 * PersonRepository en memoria. Para tests unitarios del resolver (sin DB) y
 * dev local. Replica el comportamiento clave del adaptador Supabase:
 *   - findIdentity global devuelve el match más antiguo (orden de inserción).
 *   - insertIdentity es idempotente por (source_platform, id_type, id_normalized).
 *   - mergePersons re-apunta identidades y marca merged_into.
 */
import { randomUUID } from "node:crypto";
import type {
  IdentityLookup,
  NewIdentity,
  PersonRepository,
} from "../domain/person-repository.port.js";
import type { PersonIdentityRecord, PersonRecord } from "../domain/person.types.js";

export class InMemoryPersonRepository implements PersonRepository {
  private readonly persons = new Map<string, PersonRecord>();
  private readonly identities: PersonIdentityRecord[] = [];

  async findIdentity(lookup: IdentityLookup): Promise<PersonIdentityRecord | null> {
    const match = this.identities.find(
      (i) =>
        i.id_type === lookup.id_type &&
        i.id_normalized === lookup.id_normalized &&
        (lookup.source_platform === undefined || i.source_platform === lookup.source_platform),
    );
    return match ?? null;
  }

  async getPerson(personId: string): Promise<PersonRecord | null> {
    return this.persons.get(personId) ?? null;
  }

  async createPerson(displayName: string | null): Promise<PersonRecord> {
    const person: PersonRecord = { id: randomUUID(), display_name: displayName, merged_into: null };
    this.persons.set(person.id, person);
    return person;
  }

  async insertIdentity(identity: NewIdentity): Promise<PersonIdentityRecord> {
    const existing = this.identities.find(
      (i) =>
        i.source_platform === identity.source_platform &&
        i.id_type === identity.id_type &&
        i.id_normalized === identity.id_normalized,
    );
    if (existing !== undefined) return existing; // idempotente (UNIQUE)

    const row: PersonIdentityRecord = {
      id: randomUUID(),
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

  async mergePersons(survivorId: string, absorbedId: string): Promise<void> {
    for (let idx = 0; idx < this.identities.length; idx++) {
      const row = this.identities[idx];
      if (row !== undefined && row.person_id === absorbedId) {
        this.identities[idx] = { ...row, person_id: survivorId };
      }
    }
    const absorbed = this.persons.get(absorbedId);
    if (absorbed !== undefined) {
      this.persons.set(absorbedId, { ...absorbed, merged_into: survivorId });
    }
  }
}
