/**
 * Puertos del dominio de identidad (hexagonal / DDD). La aplicación depende de
 * ESTAS interfaces, nunca de la DB. Modelo owner con RLS en la base:
 *
 *   - OwnerResolver: traduce (source_platform, tenant_id) -> owner_id. Único
 *     paso privilegiado (SECURITY DEFINER en la DB). Devuelve null si el tenant
 *     no está mapeado (fail-closed).
 *   - IdentityUnitOfWork.withOwner: abre el contexto de owner (transacción +
 *     SET LOCAL app.current_owner_id) para que RLS aísle TODO por owner, y
 *     ejecuta la unidad de trabajo con un IdentityStore ya scoped.
 *   - IdentityStore: operaciones de identidad dentro de ese contexto. El
 *     `ownerId` explícito en cada op es defensa en profundidad sobre la RLS.
 */
import type { IdType, PersonId } from "@raisen/cerebro-contracts";
import type { OwnerId, PersonIdentityRecord, PersonRecord } from "./person.types.js";

/** Búsqueda de identidad ya normalizada, dentro de un owner. */
export interface IdentityLookup {
  readonly id_type: IdType;
  readonly id_normalized: string;
}

/** Datos para insertar una identidad (ya normalizada). */
export interface NewIdentity {
  readonly owner_id: OwnerId;
  readonly person_id: PersonId;
  readonly source_platform: string;
  readonly id_type: IdType;
  readonly id_value: string;
  readonly id_normalized: string;
  readonly confidence: number;
}

export interface OwnerResolver {
  /** (source_platform, tenant_id) -> owner_id, o null si no hay mapeo (fail-closed). */
  resolveOwnerId(sourcePlatform: string, platformTenantId: string): Promise<OwnerId | null>;
}

export interface IdentityStore {
  findIdentity(ownerId: OwnerId, lookup: IdentityLookup): Promise<PersonIdentityRecord | null>;
  getPerson(ownerId: OwnerId, personId: PersonId): Promise<PersonRecord | null>;
  createPerson(ownerId: OwnerId, displayName: string | null): Promise<PersonRecord>;
  /**
   * Inserta una identidad. Idempotente: si ya existe la combinación UNIQUE
   * (owner_id, id_type, id_normalized) devuelve la fila existente sin duplicar.
   */
  insertIdentity(identity: NewIdentity): Promise<PersonIdentityRecord>;
  /** Fusiona dentro del MISMO owner: re-apunta identidades y marca merged_into. */
  mergePersons(ownerId: OwnerId, survivorId: PersonId, absorbedId: PersonId): Promise<void>;
}

export interface IdentityUnitOfWork {
  /**
   * Ejecuta `fn` con el contexto de owner fijado (RLS activa). En la DB real es
   * una transacción con `SET LOCAL app.current_owner_id`.
   */
  withOwner<T>(ownerId: OwnerId, fn: (store: IdentityStore) => Promise<T>): Promise<T>;
}
