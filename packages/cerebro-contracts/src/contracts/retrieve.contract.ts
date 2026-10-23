/**
 * CEREBRO — Contrato de RETRIEVAL (lectura con scope)
 * ----------------------------------------------------
 * Lo usa el agente de una plataforma ANTES de responder, para enriquecer
 * su contexto con lo que el cerebro sabe de esa persona — filtrado por el
 * scope del agente que pregunta.
 *
 * Fuente: HUB_CEREBRO_Conexion_Spec §2.2 · Arquitectura v1.2 §8.
 * Regla: nunca 500 que bloquee. Sin data -> chunks: [], degraded si parcial.
 */

import type { IdentityRef, PersonId } from "./identity.contract.js";
import type { SourcePlatform } from "./event.contract.js";

/**
 * Agentes de HUB con scope de retrieval propio (doc de agentes §3.2).
 * Abierto a otras plataformas vía string; estos son los nombrados de HUB v1.
 */
export type RequestingAgent =
  | "victor"
  | "zahra"
  | "thao"
  | "iris"
  | "eco"
  | "angel"
  | "kelsy"
  | (string & {}); // permite agentes de otras plataformas sin perder el autocompletado

/** Visibilidad de un chunk — el scope del agente decide qué puede leer. */
export type Visibility = "public" | "internal" | "financial" | "pii_sensitive";

export interface RetrieveRequest {
  readonly identity: IdentityRef;
  /** Texto de la conversación / intención a resolver. */
  readonly query: string;
  readonly requesting_agent: RequestingAgent;
  readonly requesting_platform: SourcePlatform;
  readonly tenant_id: string;
  /** Tope de chunks a devolver (alta señal, pocos). Default sugerido: 6. */
  readonly max_chunks?: number;
}

/** Un pedazo de conocimiento recuperado del RAG/grafo. */
export interface RetrievedChunk {
  readonly kind: string; // 'order_history' | 'conversation' | 'brand_voice' | ...
  readonly content: string;
  readonly source_platform: SourcePlatform;
  /** Similitud coseno 0..1 (mayor = más cercano). */
  readonly score: number;
}

/** Hecho con vigencia temporal (construct estilo Zep: hecho + fechas). */
export interface RetrievedFact {
  readonly text: string;
  /** ISO-8601 desde cuándo vale el hecho. */
  readonly valid_from: string;
  /** ISO-8601 hasta cuándo; null = aún vigente. */
  readonly valid_to: string | null;
}

export interface RetrieveResponse {
  readonly person_id: PersonId | null;
  readonly chunks: readonly RetrievedChunk[];
  readonly facts: readonly RetrievedFact[];
  /** true si CEREBRO respondió parcial (caído/lento) — HUB sigue con data local. */
  readonly degraded: boolean;
}
