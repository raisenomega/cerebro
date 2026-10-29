/**
 * API HTTP de CEREBRO (Conexion Spec §2): `POST /cerebro/ingest` (202 async) y
 * `POST /cerebro/retrieve` (200 con scope). node:http, sin dependencias de
 * framework. Las dependencias (owner resolver, uows, embedder, auth) se
 * inyectan, de modo que el servidor se prueba con fakes + fetch real.
 *
 * Reglas: ingest valida y encola (202); retrieve NUNCA bloquea (200, degradado
 * ante cualquier fallo). Auth por Bearer service token.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { CerebroEvent, RetrieveRequest } from "@raisen/cerebro-contracts";
import { ingestEvent, type IngestDeps } from "../rag/application/ingest-event.handler.js";
import { retrieveContext, type RetrieveDeps } from "../rag/application/retrieve-context.handler.js";
import { bearerToken, type TokenPlatformResolver } from "./auth.js";

export interface ServerDeps {
  readonly authResolver: TokenPlatformResolver;
  readonly ingestDeps: IngestDeps;
  readonly retrieveDeps: RetrieveDeps;
  /** Tope de tamaño del body (bytes). Default 1 MiB. */
  readonly maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY = 1024 * 1024;

export function createCerebroServer(deps: ServerDeps): Server {
  return createServer((req, res) => {
    void handle(deps, req, res).catch((e) =>
      sendJson(res, 500, { error: "internal", detail: errMsg(e) }),
    );
  });
}

async function handle(deps: ServerDeps, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = (req.url ?? "").split("?")[0];

  // Health check SIN auth (para el health check de Railway).
  if (req.method === "GET" && url === "/health") return sendJson(res, 200, { status: "ok" });

  if (req.method !== "POST") return sendJson(res, 405, { error: "method_not_allowed" });

  const platform = deps.authResolver(bearerToken(req.headers.authorization) ?? "");
  if (platform === null) return sendJson(res, 401, { error: "unauthorized" });

  if (url === "/cerebro/ingest") return ingestRoute(deps, platform, req, res);
  if (url === "/cerebro/retrieve") return retrieveRoute(deps, platform, req, res);
  return sendJson(res, 404, { error: "not_found" });
}

async function ingestRoute(
  deps: ServerDeps,
  platform: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJson(req, deps.maxBodyBytes ?? DEFAULT_MAX_BODY);
  if (body === null) return sendJson(res, 400, { error: "invalid_json" });
  if (!isEventShape(body)) return sendJson(res, 400, { error: "invalid_event" });
  if (body.source_platform !== platform) {
    return sendJson(res, 403, { error: "platform_mismatch" });
  }

  const result = await ingestEvent(deps.ingestDeps, body);
  if (result.ok) return sendJson(res, 202, result.value); // Accepted
  const status = ingestErrorStatus(result.error.kind);
  const detail = "detail" in result.error ? (result.error as { detail?: string }).detail : undefined;
  if (detail !== undefined) console.error(`[ingest-error] ${result.error.kind}: ${detail}`); // DIAG temporal: ver la causa raiz
  return sendJson(res, status, { error: result.error.kind, detail });
}

async function retrieveRoute(
  deps: ServerDeps,
  platform: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await readJson(req, deps.maxBodyBytes ?? DEFAULT_MAX_BODY);
  if (body === null) return sendJson(res, 400, { error: "invalid_json" });
  if (!isRetrieveShape(body)) return sendJson(res, 400, { error: "invalid_request" });
  if (body.requesting_platform !== platform) {
    return sendJson(res, 403, { error: "platform_mismatch" });
  }

  // retrieveContext nunca lanza: devuelve 200 (degradado si hubo fallo).
  const response = await retrieveContext(deps.retrieveDeps, body);
  return sendJson(res, 200, response);
}

function ingestErrorStatus(kind: string): number {
  // 5xx para fallos transitorios (embed/DB); 422 para datos del cliente.
  return kind === "embedding_failed" || kind === "repository_error" ? 503 : 422;
}

// --- helpers --------------------------------------------------------------

function isEventShape(v: unknown): v is CerebroEvent {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o["event"] === "string" &&
    typeof o["source_platform"] === "string" &&
    typeof o["tenant_id"] === "string" &&
    typeof o["occurred_at"] === "string" &&
    typeof o["identity"] === "object" &&
    o["identity"] !== null
  );
}

function isRetrieveShape(v: unknown): v is RetrieveRequest {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o["query"] === "string" &&
    typeof o["requesting_agent"] === "string" &&
    typeof o["requesting_platform"] === "string" &&
    typeof o["tenant_id"] === "string" &&
    typeof o["identity"] === "object" &&
    o["identity"] !== null
  );
}

function readJson(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve) => {
    const parts: Buffer[] = [];
    let size = 0;
    let aborted = false;
    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      size += chunk.length;
      if (size > maxBytes) {
        aborted = true;
        resolve(null);
        return;
      }
      parts.push(chunk);
    });
    req.on("end", () => {
      if (aborted) return;
      const raw = Buffer.concat(parts).toString("utf8").trim();
      if (raw === "") return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
