/**
 * Scope de visibilidad por agente (Arquitectura §8). Deny-by-default sobre lo
 * sensible: hasta confirmar la tabla exacta del doc de agentes §3.2, NINGÚN
 * agente recibe chunks `financial` ni `pii_sensitive`; solo `public`+`internal`.
 * El retrieve filtra por esto encima de la RLS por owner.
 *
 * TODO(owner): confirmar la tabla por agente (§3.2) y poblar AGENT_SCOPE
 * (p.ej. victor/zahra con 'financial' para cobrar).
 */
import type { RequestingAgent, Visibility } from "@raisen/cerebro-contracts";

const DEFAULT_SCOPE: readonly Visibility[] = ["public", "internal"];

const AGENT_SCOPE: Readonly<Record<string, readonly Visibility[]>> = {
  // victor: ["public", "internal", "financial"],  // pendiente de confirmar §3.2
};

export function agentVisibilityScope(agent: RequestingAgent): readonly Visibility[] {
  return AGENT_SCOPE[agent] ?? DEFAULT_SCOPE;
}
