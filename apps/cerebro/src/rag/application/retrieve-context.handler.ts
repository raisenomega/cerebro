/**
 * Retrieve con scope (Conexion Spec §2.2). Enriquece, NO bloquea:
 *   1. traducir (requesting_platform, tenant_id) -> owner (fail-closed).
 *   2. resolver la persona por identidad SOLO lectura (no crea).
 *   3. embeber la query (Voyage) y buscar RAG por similitud dentro del owner y
 *      la persona, filtrando por el scope de visibilidad del `requesting_agent`.
 * NUNCA lanza: ante cualquier fallo (tenant desconocido, Voyage caído, DB) o
 * sin persona, devuelve una respuesta vacía (`degraded` si fue por fallo).
 */
import type { RetrieveRequest, RetrieveResponse } from "@raisen/cerebro-contracts";
import type {
  IdentityUnitOfWork,
  OwnerResolver,
} from "../../identity/domain/person-repository.port.js";
import { normalizeIdentity } from "../../identity/domain/normalize.js";
import type { EmbeddingProvider } from "../domain/embedding.port.js";
import type { KnowledgeUnitOfWork } from "../domain/knowledge-store.port.js";
import type { ScoredChunk } from "../domain/knowledge.types.js";
import { agentVisibilityScope } from "../domain/scope.js";

export interface RetrieveDeps {
  readonly ownerResolver: OwnerResolver;
  readonly identityUow: IdentityUnitOfWork;
  readonly knowledgeUow: KnowledgeUnitOfWork;
  readonly embedder: EmbeddingProvider;
}

const DEFAULT_MAX_CHUNKS = 6;

export async function retrieveContext(
  deps: RetrieveDeps,
  req: RetrieveRequest,
): Promise<RetrieveResponse> {
  try {
    const sourcePlatform = req.requesting_platform.trim();
    const tenantId = req.tenant_id.trim();
    if (sourcePlatform === "" || tenantId === "") return degraded();

    const ownerId = await deps.ownerResolver.resolveOwnerId(sourcePlatform, tenantId);
    if (ownerId === null) return degraded(); // tenant desconocido -> vacío, no bloquea

    const normalized = normalizeIdentity(req.identity.id_type, req.identity.id_value);
    if (!normalized.ok) return emptyOk(null, []); // identidad inválida -> sin persona

    // Persona read-only (NO crea).
    const personId = await deps.identityUow.withOwner(ownerId, async (store) => {
      const row = await store.findIdentity(ownerId, {
        id_type: req.identity.id_type,
        id_normalized: normalized.value,
      });
      return row === null ? null : row.person_id;
    });
    if (personId === null) return emptyOk(null, []);

    const vectors = await deps.embedder.embed([req.query]);
    const queryEmbedding = vectors[0];
    if (queryEmbedding === undefined) return degraded();

    const limit = req.max_chunks ?? DEFAULT_MAX_CHUNKS;
    const visibilities = agentVisibilityScope(req.requesting_agent);
    const chunks = await deps.knowledgeUow.withOwner(ownerId, (store) =>
      store.searchSimilar(ownerId, personId, queryEmbedding, visibilities, limit),
    );
    return emptyOk(personId, chunks);
  } catch {
    return degraded();
  }
}

function emptyOk(personId: string | null, chunks: readonly ScoredChunk[]): RetrieveResponse {
  return { person_id: personId, chunks, facts: [], degraded: false };
}

function degraded(): RetrieveResponse {
  return { person_id: null, chunks: [], facts: [], degraded: true };
}
