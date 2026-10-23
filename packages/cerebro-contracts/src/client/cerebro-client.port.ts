/**
 * CEREBRO — Puerto del conector `cerebro-client`
 * -----------------------------------------------
 * La interfaz que cada plataforma implementa para hablar con CEREBRO.
 * HUB implementará esto en `src/integrations/infrastructure/cerebro-client.ts`.
 *
 * Contrato de comportamiento (NO negociable — "enriquece, no bloquea"):
 *  - emit(): FIRE-AND-FORGET. No lanza, no bloquea el camino crítico.
 *    Si CEREBRO está caído, el error se traga/loguea; la plataforma sigue.
 *  - retrieve(): con timeout corto + cache. Ante timeout/caída, devuelve
 *    una respuesta `degraded: true` con chunks/facts vacíos — NUNCA lanza.
 *
 * Fuente: HUB_CEREBRO_Conexion_Spec §5 · Arquitectura v1.2 §2 (regla de oro).
 */

import type { CerebroEvent } from "../contracts/event.contract.js";
import type {
  RetrieveRequest,
  RetrieveResponse,
} from "../contracts/retrieve.contract.js";

export interface CerebroClientPort {
  /**
   * Alimenta CEREBRO con un evento. Fire-and-forget: resuelve siempre,
   * nunca rechaza. Un fallo de red se traga internamente (se loguea).
   */
  emit(event: CerebroEvent): Promise<void>;

  /**
   * Consulta el contexto de una persona con el scope del agente.
   * Garantía: NUNCA lanza. Ante error/timeout devuelve una respuesta
   * degradada (ver `degradedResponse`).
   */
  retrieve(req: RetrieveRequest): Promise<RetrieveResponse>;
}

/**
 * Respuesta degradada canónica — lo que todo cliente debe devolver cuando
 * CEREBRO no responde a tiempo. Centralizada aquí para que HUB, NÚCLEO y
 * cualquier plataforma degraden igual.
 */
export function degradedResponse(): RetrieveResponse {
  return { person_id: null, chunks: [], facts: [], degraded: true };
}
