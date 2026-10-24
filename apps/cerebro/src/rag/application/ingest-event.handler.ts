/**
 * Ingesta de un evento a CEREBRO (Conexion Spec §2.3).
 * Por cada evento (v1 = identidad + RAG):
 *   1. resolver/crear `person` (Slice 1; también traduce tenant->owner, fail-closed).
 *   2. embeber el contenido (Voyage) e insertar un `knowledge_chunk`.
 * Idempotente: el mismo evento dos veces NO duplica (dedup_key) y NO re-embebe.
 * (Grafo y agent_memory son fases posteriores.)
 */
import type { CerebroEvent, IngestAck } from "@raisenomega/cerebro-contracts";
import { type Result, ok, err, isErr } from "../../shared/result.js";
import type { ResolveError } from "../../identity/domain/identity.errors.js";
import { resolvePerson, type ResolveDeps } from "../../identity/application/resolve-person.handler.js";
import type { EmbeddingProvider } from "../domain/embedding.port.js";
import type { KnowledgeUnitOfWork } from "../domain/knowledge-store.port.js";
import type { IngestError } from "../domain/errors.js";
import { computeDedupKey } from "../domain/dedup.js";
import { buildContent, visibilityForEvent } from "../domain/event-content.js";

export interface IngestDeps extends ResolveDeps {
  readonly knowledgeUow: KnowledgeUnitOfWork;
  readonly embedder: EmbeddingProvider;
}

export async function ingestEvent(
  deps: IngestDeps,
  event: CerebroEvent,
): Promise<Result<IngestAck, IngestError>> {
  // 1. Resolver persona (crea si no existe) y obtener el owner (fail-closed).
  const resolved = await resolvePerson(
    { ownerResolver: deps.ownerResolver, uow: deps.uow },
    {
      sourcePlatform: event.source_platform,
      tenantId: event.tenant_id,
      ref: event.identity,
    },
  );
  if (isErr(resolved)) return err(mapResolveError(resolved.error));
  const { owner_id, person_id } = resolved.value;

  const content = buildContent(event);
  if (content.trim() === "") return err({ kind: "empty_content" });
  const dedupKey = computeDedupKey(event);

  try {
    return await deps.knowledgeUow.withOwner(owner_id, async (store) => {
      // Idempotencia: si el evento ya se ingirió, no re-embebe ni duplica.
      const existing = await store.findByDedup(owner_id, dedupKey);
      if (existing !== null) {
        const ack: IngestAck = { accepted: true, event_id: existing.id };
        return ok(ack);
      }

      const vectors = await deps.embedder.embed([content]);
      const embedding = vectors[0];
      if (embedding === undefined) return err({ kind: "embedding_failed", detail: "sin vector" });

      const stored = await store.insertChunk({
        owner_id,
        person_id,
        source_platform: event.source_platform,
        kind: event.event,
        content,
        embedding,
        visibility: visibilityForEvent(event),
        dedup_key: dedupKey,
      });
      const ack: IngestAck = { accepted: true, event_id: stored.id };
      return ok(ack);
    });
  } catch (e) {
    return err({ kind: "repository_error", detail: e instanceof Error ? e.message : String(e) });
  }
}

function mapResolveError(e: ResolveError): IngestError {
  switch (e.kind) {
    case "missing_source_platform":
      return { kind: "missing_source_platform" };
    case "missing_tenant_id":
      return { kind: "missing_tenant_id" };
    case "unknown_tenant":
      return { kind: "unknown_tenant", source_platform: e.source_platform, tenant_id: e.tenant_id };
    case "repository_error":
      return { kind: "repository_error", detail: e.detail };
    default:
      // errores de normalización (empty_value / invalid_email|phone|handle)
      return { kind: "invalid_identity", detail: e.kind };
  }
}
