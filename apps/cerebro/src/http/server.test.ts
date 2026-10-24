import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { CerebroEvent, RetrieveRequest } from "@raisenomega/cerebro-contracts";
import { createCerebroServer } from "./server.js";
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

let server: Server;
let base: string;

const EVENT: CerebroEvent = {
  event: "message.received",
  source_platform: "hub",
  tenant_id: "t1",
  occurred_at: "2026-10-23T00:00:00Z",
  identity: { id_type: "email", id_value: "a@x.com" },
  payload: { text: "hola" },
};

const REQ: RetrieveRequest = {
  identity: { id_type: "email", id_value: "a@x.com" },
  query: "hola",
  requesting_agent: "victor",
  requesting_platform: "hub",
  tenant_id: "t1",
};

beforeAll(async () => {
  const ownerResolver = new InMemoryOwnerResolver().register("hub", "t1", "owner-1");
  const identityUow = new InMemoryIdentityUnitOfWork();
  const knowledgeUow = new InMemoryKnowledgeUnitOfWork(new InMemoryKnowledgeStore());
  const embedder = new FakeEmbedder(32);
  const scopeStore = new InMemoryScopeStore();
  server = createCerebroServer({
    authResolver: (t) => (t === "tok-hub" ? "hub" : null),
    ingestDeps: { ownerResolver, uow: identityUow, knowledgeUow, embedder },
    retrieveDeps: { ownerResolver, identityUow, knowledgeUow, embedder, scopeStore },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function post(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("API HTTP de CEREBRO", () => {
  it("ingest -> 202 y retrieve -> 200 con chunk", async () => {
    const r1 = await post("/cerebro/ingest", EVENT, "tok-hub");
    expect(r1.status).toBe(202);

    const r2 = await post("/cerebro/retrieve", REQ, "tok-hub");
    expect(r2.status).toBe(200);
    const body = (await r2.json()) as { degraded: boolean; chunks: unknown[] };
    expect(body.degraded).toBe(false);
    expect(body.chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("sin service token -> 401", async () => {
    const r = await post("/cerebro/ingest", EVENT);
    expect(r.status).toBe(401);
  });

  it("retrieve con tenant desconocido -> 200 degradado (nunca bloquea)", async () => {
    const r = await post("/cerebro/retrieve", { ...REQ, tenant_id: "nope" }, "tok-hub");
    expect(r.status).toBe(200);
    const body = (await r.json()) as { degraded: boolean };
    expect(body.degraded).toBe(true);
  });

  it("platform distinta al token -> 403", async () => {
    const r = await post("/cerebro/ingest", { ...EVENT, source_platform: "nucleo" }, "tok-hub");
    expect(r.status).toBe(403);
  });

  it("GET /health -> 200 sin auth (health check de Railway)", async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    const body = (await r.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
