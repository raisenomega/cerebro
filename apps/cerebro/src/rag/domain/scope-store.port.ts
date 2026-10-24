/**
 * Puerto del scope de visibilidad por agente (tabla `agent_scope`, §3 del doc de
 * alineación). Config global del ecosistema (no owner-scoped).
 */
import type { Visibility } from "@raisen/cerebro-contracts";

export interface ScopeStore {
  /**
   * Visibilidades que puede leer un agente. Arreglo VACÍO si el agente no está
   * registrado (fail-closed / honest-None: desconocido -> no ve nada).
   */
  visibilitiesFor(agentCode: string): Promise<Visibility[]>;
}
