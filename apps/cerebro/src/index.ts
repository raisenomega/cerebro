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

// ── Slice 2: RAG (ingesta + retrieve con scope) ──────────────────────────
export { ingestEvent, type IngestDeps } from "./rag/application/ingest-event.handler.js";
export { retrieveContext, type RetrieveDeps } from "./rag/application/retrieve-context.handler.js";
export type { ScopeStore } from "./rag/domain/scope-store.port.js";
export { PgScopeStore } from "./rag/infrastructure/pg-scope-store.js";
export { InMemoryScopeStore, SCOPE_SEED } from "./rag/infrastructure/in-memory-scope.js";
export { buildNucleoSeedEvents, type NucleoSeedCustomer } from "./seed/nucleo-seed.js";
export { computeDedupKey } from "./rag/domain/dedup.js";
export type { EmbeddingProvider } from "./rag/domain/embedding.port.js";
export type {
  KnowledgeStore,
  KnowledgeUnitOfWork,
} from "./rag/domain/knowledge-store.port.js";
export type { NewChunk, ScoredChunk, StoredChunkRef } from "./rag/domain/knowledge.types.js";
export type { IngestError } from "./rag/domain/errors.js";
export { VoyageEmbeddingProvider } from "./rag/infrastructure/voyage.adapter.js";
export { PgKnowledgeUnitOfWork } from "./rag/infrastructure/pg-knowledge-store.js";
export {
  InMemoryKnowledgeStore,
  InMemoryKnowledgeUnitOfWork,
  FakeEmbedder,
} from "./rag/infrastructure/in-memory-knowledge.js";

// HTTP
export { createCerebroServer, type ServerDeps } from "./http/server.js";
export { envTokenResolver, bearerToken, type TokenPlatformResolver } from "./http/auth.js";

// Shared
export { type Result, ok, err, isOk, isErr } from "./shared/result.js";
