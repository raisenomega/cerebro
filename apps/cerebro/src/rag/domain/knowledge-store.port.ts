/**
 * Puertos de persistencia RAG. Operan DENTRO de un contexto de owner (RLS
 * activa). Dos adaptadores: Postgres/pgvector (prod) e in-memory (tests).
 */
import type { Visibility } from "@raisen/cerebro-contracts";
import type { OwnerId } from "../../identity/domain/person.types.js";
import type { NewChunk, ScoredChunk, StoredChunkRef } from "./knowledge.types.js";

export interface KnowledgeStore {
  /** Busca un chunk por su clave de idempotencia dentro del owner. */
  findByDedup(ownerId: OwnerId, dedupKey: string): Promise<StoredChunkRef | null>;
  /**
   * Inserta un chunk. Idempotente: si ya existe (owner_id, dedup_key) devuelve
   * la fila existente sin duplicar.
   */
  insertChunk(chunk: NewChunk): Promise<StoredChunkRef>;
  /**
   * Búsqueda por similitud (coseno) dentro del owner y la persona, filtrada por
   * las `visibilities` permitidas al agente. Devuelve los `limit` más cercanos.
   */
  searchSimilar(
    ownerId: OwnerId,
    personId: string,
    queryEmbedding: readonly number[],
    visibilities: readonly Visibility[],
    limit: number,
  ): Promise<ScoredChunk[]>;
}

export interface KnowledgeUnitOfWork {
  withOwner<T>(ownerId: OwnerId, fn: (store: KnowledgeStore) => Promise<T>): Promise<T>;
}
