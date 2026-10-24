/**
 * Derivación del texto embebible y la visibilidad de un evento (v1).
 * CEREBRO guarda derivado, nunca la verdad operacional cruda.
 */
import type { CerebroEvent, Visibility } from "@raisen/cerebro-contracts";

export function buildContent(event: CerebroEvent): string {
  return `[${event.event}] ${safeStringify(event.payload)}`.trim();
}

export function visibilityForEvent(event: CerebroEvent): Visibility {
  switch (event.event) {
    case "order.created":
    case "payment.received":
      return "financial";
    default:
      return "internal";
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}
