import { describe, it, expect } from "vitest";
import type { CerebroEvent } from "@raisenomega/cerebro-contracts";
import { ingestEvent, type IngestDeps } from "./ingest-event.handler.js";
import {
  InMemoryOwnerResolver,
  InMemoryIdentityUnitOfWork,
} from "../../identity/infrastructure/in-memory-identity.js";
import {
  InMemoryKnowledgeStore,
  InMemoryKnowledgeUnitOfWork,
  FakeEmbedder,
} from "../infrastructure/in-memory-knowledge.js";

function makeDeps(): IngestDeps {
  const ownerResolver = new InMemoryOwnerResolver().register("hub", "t1", "owner-1");
  return {
    ownerResolver,
    uow: new InMemoryIdentityUnitOfWork(),
    knowledgeUow: new InMemoryKnowledgeUnitOfWork(new InMemoryKnowledgeStore()),
    embedder: new FakeEmbedder(32),
  };
}

const ev = (over: Partial<CerebroEvent> = {}): CerebroEvent => ({
  event: "message.received",
  source_platform: "hub",
  tenant_id: "t1",
  occurred_at: "2026-10-23T00:00:00Z",
  identity: { id_type: "email", id_value: "a@x.com" },
  payload: { text: "hola" },
  ...over,
});

describe("ingestEvent", () => {
  it("ingiere un evento -> accepted + event_id", async () => {
    const r = await ingestEvent(makeDeps(), ev());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.accepted).toBe(true);
      expect(r.value.event_id).toBeTruthy();
    }
  });

  it("idempotente: el mismo evento dos veces -> mismo event_id", async () => {
    const deps = makeDeps();
    const a = await ingestEvent(deps, ev());
    const b = await ingestEvent(deps, ev());
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(b.value.event_id).toBe(a.value.event_id);
  });

  it("tenant desconocido -> unknown_tenant (no ingiere, fail-closed)", async () => {
    const r = await ingestEvent(makeDeps(), ev({ tenant_id: "nope" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("unknown_tenant");
  });
});
