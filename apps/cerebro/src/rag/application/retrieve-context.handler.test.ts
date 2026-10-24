import { describe, it, expect } from "vitest";
import type { CerebroEvent, RetrieveRequest } from "@raisen/cerebro-contracts";
import { ingestEvent } from "./ingest-event.handler.js";
import { retrieveContext, type RetrieveDeps } from "./retrieve-context.handler.js";
import {
  InMemoryOwnerResolver,
  InMemoryIdentityUnitOfWork,
} from "../../identity/infrastructure/in-memory-identity.js";
import {
  InMemoryKnowledgeStore,
  InMemoryKnowledgeUnitOfWork,
  FakeEmbedder,
} from "../infrastructure/in-memory-knowledge.js";

function makeShared() {
  const ownerResolver = new InMemoryOwnerResolver().register("hub", "t1", "owner-1");
  const identityUow = new InMemoryIdentityUnitOfWork();
  const knowledgeUow = new InMemoryKnowledgeUnitOfWork(new InMemoryKnowledgeStore());
  const embedder = new FakeEmbedder(32);
  return {
    ingestDeps: { ownerResolver, uow: identityUow, knowledgeUow, embedder },
    retrieveDeps: { ownerResolver, identityUow, knowledgeUow, embedder } satisfies RetrieveDeps,
  };
}

const ev = (over: Partial<CerebroEvent> = {}): CerebroEvent => ({
  event: "message.received",
  source_platform: "hub",
  tenant_id: "t1",
  occurred_at: "2026-10-23T00:00:00Z",
  identity: { id_type: "email", id_value: "a@x.com" },
  payload: { text: "hola cliente" },
  ...over,
});

const rq = (over: Partial<RetrieveRequest> = {}): RetrieveRequest => ({
  identity: { id_type: "email", id_value: "a@x.com" },
  query: "hola cliente",
  requesting_agent: "victor",
  requesting_platform: "hub",
  tenant_id: "t1",
  ...over,
});

describe("retrieveContext", () => {
  it("devuelve los chunks de la persona (no degradado)", async () => {
    const { ingestDeps, retrieveDeps } = makeShared();
    await ingestEvent(ingestDeps, ev());
    const res = await retrieveContext(retrieveDeps, rq());
    expect(res.degraded).toBe(false);
    expect(res.person_id).not.toBeNull();
    expect(res.chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("el scope del agente filtra lo financial (default no lo incluye)", async () => {
    const { ingestDeps, retrieveDeps } = makeShared();
    await ingestEvent(ingestDeps, ev()); // internal
    await ingestEvent(ingestDeps, ev({ event: "order.created", payload: { total: 150 } })); // financial
    const res = await retrieveContext(retrieveDeps, rq());
    expect(res.degraded).toBe(false);
    expect(res.chunks.some((c) => c.kind === "message.received")).toBe(true);
    expect(res.chunks.every((c) => c.kind !== "order.created")).toBe(true);
  });

  it("tenant desconocido -> degradado y vacío", async () => {
    const { retrieveDeps } = makeShared();
    const res = await retrieveContext(retrieveDeps, rq({ tenant_id: "nope" }));
    expect(res.degraded).toBe(true);
    expect(res.chunks).toHaveLength(0);
  });

  it("persona no conocida -> ok vacío (no degradado)", async () => {
    const { retrieveDeps } = makeShared();
    const res = await retrieveContext(retrieveDeps, rq({ identity: { id_type: "email", id_value: "nadie@x.com" } }));
    expect(res.degraded).toBe(false);
    expect(res.person_id).toBeNull();
    expect(res.chunks).toHaveLength(0);
  });

  it("embedder caído -> degradado (enriquece, no bloquea)", async () => {
    const { ingestDeps, retrieveDeps } = makeShared();
    await ingestEvent(ingestDeps, ev()); // persona + chunk existen
    const broken: RetrieveDeps = {
      ...retrieveDeps,
      embedder: {
        dimension: 32,
        async embed(): Promise<number[][]> {
          throw new Error("voyage down");
        },
      },
    };
    const res = await retrieveContext(broken, rq());
    expect(res.degraded).toBe(true);
    expect(res.chunks).toHaveLength(0);
  });
});
