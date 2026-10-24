/**
 * ScopeStore sobre Postgres: lee `agent_scope`. Config global (no owner-scoped),
 * así que consulta directa por el pool. Sin filas -> [] (fail-closed).
 */
import { type Pool } from "pg";
import type { Visibility } from "@raisen/cerebro-contracts";
import type { ScopeStore } from "../domain/scope-store.port.js";

interface VisibilityRow {
  readonly visibility: string;
}

export class PgScopeStore implements ScopeStore {
  constructor(private readonly pool: Pool) {}

  async visibilitiesFor(agentCode: string): Promise<Visibility[]> {
    const res = await this.pool.query<VisibilityRow>(
      "SELECT visibility FROM agent_scope WHERE agent_code = $1",
      [agentCode],
    );
    return res.rows.map((r) => r.visibility as Visibility); // el CHECK de la DB garantiza el dominio
  }
}
