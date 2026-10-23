/**
 * @raisen/cerebro — servicio de cognición compartida.
 * Slice 1: dominio de identidad (resolver determinístico + merge) y adaptadores.
 */

// Casos de uso (aplicación)
export { resolvePerson } from "./identity/application/resolve-person.handler.js";
export { mergePersons } from "./identity/application/merge-persons.handler.js";

// Dominio
export { normalizeIdentity } from "./identity/domain/normalize.js";
export type {
  PersonRepository,
  IdentityLookup,
  NewIdentity,
} from "./identity/domain/person-repository.port.js";
export type {
  PersonRecord,
  PersonIdentityRecord,
  ResolveOutcome,
  ResolveStatus,
} from "./identity/domain/person.types.js";
export type { ResolveError, MergeError, NormalizeError } from "./identity/domain/identity.errors.js";

// Infraestructura
export { SupabasePersonRepository } from "./identity/infrastructure/person-repository.supabase.js";
export { InMemoryPersonRepository } from "./identity/infrastructure/in-memory-person-repository.js";
export { createServiceClient } from "./identity/infrastructure/supabase-client.js";

// Shared
export { type Result, ok, err, isOk, isErr } from "./shared/result.js";
