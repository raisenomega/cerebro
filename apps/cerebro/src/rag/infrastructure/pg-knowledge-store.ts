/**
 * Adaptador Postgres/pgvector del dominio RAG. Conexión directa con rol
 * `cerebro_api` (sin BYPASSRLS); cada unidad de trabajo abre una transacción y
 * fija `SET LOCAL app.current_owner_id` para que la RLS aísle por owner.
 * ÚNICO lugar RAG que toca `pg`.
 */
import { type Pool, type PoolClient } from "pg";
import type { Visibility } from "@raisen/cerebro-contracts";
import type { OwnerId } from "../../identity/domain/person.types.js";
import type {
  KnowledgeStore,
  KnowledgeUnitOfWork,
} from "../domain/knowledge-store.port.js";
import type { NewChunk, ScoredChunk, StoredChunkRef } from "../domain/knowledge.types.js";

interface IdRow {
  readonly id: string;
}
interface ScoredRow {
  readonly kind: string;
  readonly content: string;
  readonly source_platform: string;
  readonly score: number | string;
}

export class PgKnowledgeUnitOfWork implements KnowledgeUnitOfWork {
  constructor(private readonly pool: Pool) {}

  async withOwner<T>(ownerId: OwnerId, fn: (store: KnowledgeStore) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_owner_id', $1, true)", [ownerId]);
      const result = await fn(new PgKnowledgeStore(client));
      await client.query("COMMIT");
      return result;
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* conexión ya rota */
      }
      throw e;
    } finally {
      client.release();
    }
  }
}

class PgKnowledgeStore implements KnowledgeStore {
  constructor(private readonly client: PoolClient) {}

  async findByDedup(ownerId: OwnerId, dedupKey: string): Promise<StoredChunkRef | null> {
    const res = await this.client.query<IdRow>(
      "SELECT id FROM knowledge_chunk WHERE owner_id = $1 AND dedup_key = $2 LIMIT 1",
      [ownerId, dedupKey],
    );
    const row = res.rows[0];
    return row === undefined ? null : { id: row.id };
  }

  async insertChunk(chunk: NewChunk): Promise<StoredChunkRef> {
    const vec = toVectorLiteral(chunk.embedding);
    const inserted = await this.client.query<IdRow>(
      `INSERT INTO knowledge_chunk
         (owner_id, person_id, source_platform, kind, content, embedding, visibility, dedup_key)
       VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8)
       ON CONFLICT (owner_id, dedup_key) DO NOTHING
       RETURNING id`,
      [
        chunk.owner_id,
        chunk.person_id,
        chunk.source_platform,
        chunk.kind,
        chunk.content,
        vec,
        chunk.visibility,
        chunk.dedup_key,
      ],
    );
    const insertedRow = inserted.rows[0];
    if (insertedRow !== undefined) return { id: insertedRow.id };

    const existing = await this.findByDedup(chunk.owner_id, chunk.dedup_key);
    if (existing === null) throw new Error("insertChunk: ni insertó ni encontró la fila");
    return existing;
  }

  async searchSimilar(
    ownerId: OwnerId,
    personId: string,
    queryEmbedding: readonly number[],
    visibilities: readonly Visibility[],
    limit: number,
  ): Promise<ScoredChunk[]> {
    const vec = toVectorLiteral(queryEmbedding);
    const res = await this.client.query<ScoredRow>(
      `SELECT kind, content, source_platform, 1 - (embedding <=> $4::vector) AS score
       FROM knowledge_chunk
       WHERE owner_id = $1 AND person_id = $2 AND visibility = ANY($3::text[])
       ORDER BY embedding <=> $4::vector
       LIMIT $5`,
      [ownerId, personId, [...visibilities], vec, limit],
    );
    return res.rows.map((r) => ({
      kind: r.kind,
      content: r.content,
      source_platform: r.source_platform,
      score: typeof r.score === "string" ? Number(r.score) : r.score,
    }));
  }
}

/** pgvector acepta el literal textual '[v1,v2,…]' casteado a ::vector. */
function toVectorLiteral(embedding: readonly number[]): string {
  return "[" + embedding.join(",") + "]";
}
