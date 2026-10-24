/**
 * Tipos del dominio RAG (knowledge_chunk). Scoped por owner (modelo del Slice 1).
 */
import type { Visibility } from "@raisenomega/cerebro-contracts";
import type { OwnerId } from "../../identity/domain/person.types.js";

export interface NewChunk {
  readonly owner_id: OwnerId;
  readonly person_id: string | null;
  readonly source_platform: string;
  readonly kind: string;
  readonly content: string;
  readonly embedding: readonly number[];
  readonly visibility: Visibility;
  /** Hash determinístico del evento: idempotencia por (owner_id, dedup_key). */
  readonly dedup_key: string;
}

export interface StoredChunkRef {
  readonly id: string;
}

/** Chunk recuperado con su similitud (forma compatible con RetrievedChunk del contrato). */
export interface ScoredChunk {
  readonly kind: string;
  readonly content: string;
  readonly source_platform: string;
  /** Similitud coseno 0..1 (mayor = más cercano). */
  readonly score: number;
}
