/**
 * CEREBRO — Stub no-op del `cerebro-client`
 * ------------------------------------------
 * Implementación vacía del puerto. Permite que HUB (y cualquier plataforma)
 * importe e integre el conector ANTES de que CEREBRO exista:
 *  - emit() no hace nada (se traga el evento).
 *  - retrieve() devuelve siempre la respuesta degradada (sin data).
 *
 * Así el context-builder del agente ya puede llamar `retrieve()` desde hoy;
 * cuando CEREBRO esté arriba, se cambia el stub por el cliente HTTP real sin
 * tocar el resto del código del agente.
 *
 * Criterio de aceptación del Slice 0: esto compila y se puede importar desde
 * HUB sin que CEREBRO exista.
 */

import type { CerebroEvent } from "../contracts/event.contract.js";
import type {
  RetrieveRequest,
  RetrieveResponse,
} from "../contracts/retrieve.contract.js";
import {
  type CerebroClientPort,
  degradedResponse,
} from "./cerebro-client.port.js";

export class CerebroClientStub implements CerebroClientPort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async emit(_event: CerebroEvent): Promise<void> {
    // no-op: se traga el evento. CEREBRO aún no existe.
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async retrieve(_req: RetrieveRequest): Promise<RetrieveResponse> {
    // sin cerebro -> siempre degradado, sin data. La plataforma sigue local.
    return degradedResponse();
  }
}
