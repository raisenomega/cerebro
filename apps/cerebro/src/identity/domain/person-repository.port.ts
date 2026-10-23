/**
 * Puerto de persistencia del dominio de identidad (hexagonal / DDD). La
 * aplicación depende de ESTA interfaz, nunca de Supabase. Dos adaptadores:
 * Supabase (prod) e in-memory (tests / dev local).
 *
 * Corre con service_role (BYPASSRLS): ve TODAS las identidades para poder
 * unificar cross-plataforma (Arquitectura §5). El aislamiento por plataforma
 * (RLS) aplica a los roles de cliente, no al resolver.
 */
import type { IdType, PersonId } from "@raisen/cerebro-contracts";
import type { PersonIdentityRecord, PersonRecord } from "./person.types.js";

/** Criterio de búsqueda de una identidad ya normalizada. */
export interface IdentityLookup {
  readonly id_type: IdType;
  readonly id_normalized: string;
  /** Presente SOLO para `local_id` (búsqueda acotada a la plataforma). */
  readonly source_platform?: string;
}

/** Datos para insertar una identidad (ya normalizada). */
export interface NewIdentity {
  readonly person_id: PersonId;
  readonly source_platform: string;
  readonly id_type: IdType;
  readonly id_value: string;
  readonly id_normalized: string;
  readonly confidence: number;
}

export interface PersonRepository {
  /** Busca una identidad. Para lookups globales devuelve el match más antiguo. */
  findIdentity(lookup: IdentityLookup): Promise<PersonIdentityRecord | null>;
  getPerson(personId: PersonId): Promise<PersonRecord | null>;
  createPerson(displayName: string | null): Promise<PersonRecord>;
  /**
   * Inserta una identidad. Idempotente: si ya existe la combinación UNIQUE
   * (source_platform, id_type, id_normalized) devuelve la fila existente sin
   * duplicar.
   */
  insertIdentity(identity: NewIdentity): Promise<PersonIdentityRecord>;
  /** Fusiona: marca `absorbed.merged_into = survivor` y re-apunta sus identidades. */
  mergePersons(survivorId: PersonId, absorbedId: PersonId): Promise<void>;
}
