/**
 * E2E del loop (lado CEREBRO, en memoria): NÚCLEO ingiere -> otra plataforma
 * (HUB) consulta con el slug de su agente -> ve el historial del MISMO owner.
 * Verifica los tres criterios del Slice 3 (el "ajá", scope financial, fail-closed).
 */
import { describe, it, expect } from "vitest";
import type { RetrieveRequest } from "@raisen/cerebro-contracts";
import { buildNucleoSeedEvents } from "./nucleo-seed.js";
import { ingestEvent, type IngestDeps } from "../rag/application/ingest-event.handler.js";
import { retrieveContext, type RetrieveDeps } from "../rag/application/retrieve-context.handler.js";
import {
  InMemoryOwnerResolver,
  InMemoryIdentityUnitOfWork,
} from "../identity/infrastructure/in-memory-identity.js";
import {
  InMemoryKnowledgeStore,
  InMemoryKnowledgeUnitOfWork,
  FakeEmbedder,
} from "../rag/infrastructure/in-memory-knowledge.js";
import { InMemoryScopeStore } from "../rag/infrastructure/in-memory-scope.js";

const NUCLEO_TENANT = "nucleo-tenant-test";
const HUB_TENANT = "hub-tenant-test";
const OWNER = "owner-zafacones";
const EMAIL = "cliente@zafacones.test";

function stack(): { ingestDeps: IngestDeps; retrieveDeps: RetrieveDeps } {
  // Los tenants de NÚCLEO y HUB del MISMO negocio mapean al MISMO owner.
  const ownerResolver = new InMemoryOwnerResolver()
    .register("nucleo", NUCLEO_TENANT, OWNER)
    .register("hub", HUB_TENANT, OWNER);
  const identityUow = new InMemoryIdentityUnitOfWork();
  const knowledgeUow = new InMemoryKnowledgeUnitOfWork(new InMemoryKnowledgeStore());
  const embedder = new FakeEmbedder(64);
  const scopeStore = new InMemoryScopeStore();
  return {
    ingestDeps: { ownerResolver, uow: identityUow, knowledgeUow, embedder },
    retrieveDeps: { ownerResolver, identityUow, knowledgeUow, embedder, scopeStore },
  };
}

async function seedNucleo(ingestDeps: IngestDeps): Promise<void> {
  for (const ev of buildNucleoSeedEvents({ tenantId: NUCLEO_TENANT, email: EMAIL, fullName: "Cliente Zafacones" })) {
    const r = await ingestEvent(ingestDeps, ev);
    expect(r.ok).toBe(true);
  }
}

// HUB consulta (su tenant, mismo owner) con el slug del agente.
const rq = (agent: string): RetrieveRequest => ({
  identity: { id_type: "email", id_value: EMAIL },
  query: "historial de ordenes del cliente",
  requesting_agent: agent,
  requesting_platform: "hub",
  tenant_id: HUB_TENANT,
  max_chunks: 20,
});

describe("Slice 3 — loop NÚCLEO -> CEREBRO -> retrieve", () => {
  it('el "ajá": victor (vía HUB) ve el historial de órdenes de NÚCLEO + pagos', async () => {
    const { ingestDeps, retrieveDeps } = stack();
    await seedNucleo(ingestDeps);
    const res = await retrieveContext(retrieveDeps, rq("victor"));
    expect(res.degraded).toBe(false);
    expect(res.person_id).not.toBeNull();
    expect(res.chunks.some((c) => c.kind === "order.created")).toBe(true); // internal, visible
    expect(res.chunks.some((c) => c.kind === "payment.received")).toBe(true); // financial, victor sí
  });

  it("eco NO ve lo financial (payment.received), pero sí lo internal (órdenes)", async () => {
    const { ingestDeps, retrieveDeps } = stack();
    await seedNucleo(ingestDeps);
    const res = await retrieveContext(retrieveDeps, rq("eco"));
    expect(res.degraded).toBe(false);
    expect(res.chunks.every((c) => c.kind !== "payment.received")).toBe(true);
    expect(res.chunks.some((c) => c.kind === "order.created")).toBe(true);
  });

  it("agente desconocido -> vacío (fail-closed / honest-None)", async () => {
    const { ingestDeps, retrieveDeps } = stack();
    await seedNucleo(ingestDeps);
    const res = await retrieveContext(retrieveDeps, rq("agente-fantasma"));
    expect(res.chunks).toHaveLength(0);
  });
});
