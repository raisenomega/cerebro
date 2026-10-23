/**
 * CEREBRO — Contrato de EVENTO (ingesta)
 * ---------------------------------------
 * El envelope uniforme que toda plataforma emite a POST /cerebro/ingest.
 * Fire-and-forget: CEREBRO responde 202 y procesa en background
 * (resuelve person -> grafo -> embebe RAG -> agent_memory si hubo decisión).
 *
 * Fuente: HUB_CEREBRO_Conexion_Spec §2.3 · Arquitectura v1.2 §7.
 */

import type { IdentityRef } from "./identity.contract.js";

/** Plataforma de origen. Abierto por diseño (tabla `platform`), no enum cerrado. */
export type SourcePlatform = string; // 'hub' | 'nucleo' | 'omega' | 'x'...

/**
 * Nombres de evento del contrato uniforme v1.
 * HUB emite los de conversación; NÚCLEO los de negocio.
 */
export type EventName =
  // HUB
  | "message.received"
  | "conversation.resolved"
  | "contact.updated"
  // NÚCLEO
  | "customer.created"
  | "order.created"
  | "payment.received";

/**
 * Envelope de evento de ingesta. `payload` es libre por evento (datos
 * derivados, nunca la verdad operacional cruda ni dato sensible crudo).
 */
export interface CerebroEvent<TPayload = Readonly<Record<string, unknown>>> {
  readonly event: EventName;
  readonly source_platform: SourcePlatform;
  readonly tenant_id: string;
  /** ISO-8601. */
  readonly occurred_at: string;
  readonly identity: IdentityRef;
  readonly payload: TPayload;
}

/** Respuesta de la ingesta: 202 Accepted, CEREBRO encola. */
export interface IngestAck {
  readonly accepted: true;
  /** Id de deduplicación/idempotencia que CEREBRO asigna al evento. */
  readonly event_id: string;
}
