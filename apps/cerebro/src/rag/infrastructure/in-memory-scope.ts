/**
 * ScopeStore en memoria (tests/dev) + la semilla canónica del scope por agente.
 * SCOPE_SEED DEBE coincidir con el seed de la migración 003 (agent_scope).
 */
import type { Visibility } from "@raisen/cerebro-contracts";
import type { ScopeStore } from "../domain/scope-store.port.js";

export const SCOPE_SEED: Readonly<Record<string, readonly Visibility[]>> = {
  victor: ["public", "internal", "financial", "pii_sensitive"],
  zahra: ["public", "internal", "financial"],
  kelsy: ["public", "internal", "financial"],
  thao: ["public", "internal"],
  iris: ["public", "internal"],
  eco: ["public", "internal"],
  angel: ["public", "internal", "pii_sensitive"],
};

export class InMemoryScopeStore implements ScopeStore {
  constructor(
    private readonly table: Readonly<Record<string, readonly Visibility[]>> = SCOPE_SEED,
  ) {}

  async visibilitiesFor(agentCode: string): Promise<Visibility[]> {
    return [...(this.table[agentCode] ?? [])]; // sin filas -> [] (fail-closed)
  }
}
