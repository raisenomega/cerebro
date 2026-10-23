/**
 * @raisen/cerebro — servicio de cognición compartida.
 * Slice 1: dominio de identidad por owner (resolver determinístico + merge),
 * con RLS en la base. Adaptadores Postgres (prod) e in-memory (tests/dev).
 */

// Casos de uso (aplicación)
export {
  resolvePerson,
  type ResolveDeps,
  type ResolveInput,
} from "./identity/application/resolve-person.handler.js";
export { mergePersons } from "./identity/application/merge-persons.handler.js";

// Dominio
export { normalizeIdentity } from "./identity/domain/normalize.js";
export type {
  OwnerResolver,
  IdentityStore,
  IdentityUnitOfWork,
  IdentityLookup,
  NewIdentity,
} from "./identity/domain/person-repository.port.js";
export type {
  OwnerId,
  OwnerRecord,
  PersonRecord,
  PersonIdentityRecord,
  ResolveOutcome,
  ResolveStatus,
} from "./identity/domain/person.types.js";
export type { ResolveError, MergeError, NormalizeError } from "./identity/domain/identity.errors.js";

// Infraestructura
export {
  PgOwnerResolver,
  PgIdentityUnitOfWork,
} from "./identity/infrastructure/pg-identity.repository.js";
export {
  InMemoryOwnerResolver,
  InMemoryIdentityStore,
  InMemoryIdentityUnitOfWork,
} from "./identity/infrastructure/in-memory-identity.js";

// Shared
export { type Result, ok, err, isOk, isErr } from "./shared/result.js";
