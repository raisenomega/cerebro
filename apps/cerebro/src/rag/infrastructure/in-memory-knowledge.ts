/**
 * Adaptadores RAG en memoria + embedder determinístico. Para tests (sin DB ni
 * Voyage) y dev local. Replican el aislamiento por owner y la idempotencia.
 */
import { randomUUID } from "node:crypto";
import type { Visibility } from "@raisenomega/cerebro-contracts";
import type { OwnerId } from "../../identity/domain/person.types.js";
import type { EmbeddingProvider } from "../domain/embedding.port.js";
import type {
  KnowledgeStore,
  KnowledgeUnitOfWork,
} from "../domain/knowledge-store.port.js";
import type { NewChunk, ScoredChunk, StoredChunkRef } from "../domain/knowledge.types.js";

interface StoredChunk {
  readonly id: string;
  readonly owner_id: OwnerId;
  readonly person_id: string | null;
  readonly source_platform: string;
  readonly kind: string;
  readonly content: string;
  readonly embedding: readonly number[];
  readonly visibility: Visibility;
  readonly dedup_key: string;
}

export class InMemoryKnowledgeStore implements KnowledgeStore {
  private readonly chunks: StoredChunk[] = [];

  async findByDedup(ownerId: OwnerId, dedupKey: string): Promise<StoredChunkRef | null> {
    const row = this.chunks.find((c) => c.owner_id === ownerId && c.dedup_key === dedupKey);
    return row === undefined ? null : { id: row.id };
  }

  async insertChunk(chunk: NewChunk): Promise<StoredChunkRef> {
    const existing = this.chunks.find(
      (c) => c.owner_id === chunk.owner_id && c.dedup_key === chunk.dedup_key,
    );
    if (existing !== undefined) return { id: existing.id }; // idempotente

    const row: StoredChunk = { id: randomUUID(), ...chunk };
    this.chunks.push(row);
    return { id: row.id };
  }

  async searchSimilar(
    ownerId: OwnerId,
    personId: string,
    queryEmbedding: readonly number[],
    visibilities: readonly Visibility[],
    limit: number,
  ): Promise<ScoredChunk[]> {
    const allowed = new Set<Visibility>(visibilities);
    return this.chunks
      .filter(
        (c) => c.owner_id === ownerId && c.person_id === personId && allowed.has(c.visibility),
      )
      .map((c) => ({
        kind: c.kind,
        content: c.content,
        source_platform: c.source_platform,
        score: cosine(queryEmbedding, c.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export class InMemoryKnowledgeUnitOfWork implements KnowledgeUnitOfWork {
  constructor(private readonly store: InMemoryKnowledgeStore = new InMemoryKnowledgeStore()) {}

  async withOwner<T>(_ownerId: OwnerId, fn: (store: KnowledgeStore) => Promise<T>): Promise<T> {
    return fn(this.store);
  }
}

/** Embedder determinístico para tests: mismo texto -> mismo vector normalizado. */
export class FakeEmbedder implements EmbeddingProvider {
  readonly dimension: number;
  constructor(dimension = 1024) {
    this.dimension = dimension;
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    return texts.map((t) => vecFromText(t, this.dimension));
  }
}

function vecFromText(text: string, dim: number): number[] {
  const v = new Array<number>(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    const idx = i % dim;
    v[idx] = (v[idx] ?? 0) + text.charCodeAt(i) + 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
