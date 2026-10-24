/**
 * Clave de idempotencia de un evento de ingesta. Dos emisiones del mismo evento
 * (mismo contenido lógico) producen la MISMA clave -> no se duplica el chunk.
 * Hash estable (claves ordenadas) para que el orden de serialización no influya.
 */
import { createHash } from "node:crypto";
import type { CerebroEvent } from "@raisen/cerebro-contracts";

export function computeDedupKey(event: CerebroEvent): string {
  const canonical = stableStringify({
    event: event.event,
    source_platform: event.source_platform,
    tenant_id: event.tenant_id,
    occurred_at: event.occurred_at,
    identity: event.identity,
    payload: event.payload,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  );
}
