/**
 * @raisen/cerebro-contracts
 * --------------------------
 * Contratos compartidos del ecosistema RAISEN.dev para hablar con CEREBRO.
 * Lo importan TANTO CEREBRO (al implementar la API) COMO cada plataforma
 * (al implementar su cerebro-client). Es la frontera que todos respetan.
 *
 * Slice 0 — primero, siempre. No toca DB ni Voyage; solo tipos + stub.
 */

// Contratos
export type {
  IdType,
  IdentityRef,
  ResolvedIdentity,
  PersonId,
} from "./contracts/identity.contract.js";

export type {
  SourcePlatform,
  EventName,
  CerebroEvent,
  IngestAck,
} from "./contracts/event.contract.js";

export type {
  RequestingAgent,
  Visibility,
  RetrieveRequest,
  RetrievedChunk,
  RetrievedFact,
  RetrieveResponse,
} from "./contracts/retrieve.contract.js";

// Puerto + helper de degradación
export { type CerebroClientPort, degradedResponse } from "./client/cerebro-client.port.js";

// Stub no-op (para integrar antes de que CEREBRO exista)
export { CerebroClientStub } from "./client/cerebro-client.stub.js";
