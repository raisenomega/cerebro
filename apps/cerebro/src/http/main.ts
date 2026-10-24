/**
 * Entrypoint de la API de CEREBRO. Cablea los adaptadores reales (Postgres con
 * rol cerebro_api vía DATABASE_URL, Voyage, auth por env) y levanta el servidor.
 * Ejecutar: `node dist/http/main.js` (en Railway). No se importa en tests.
 */
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { PgIdentityUnitOfWork, PgOwnerResolver } from "../identity/infrastructure/pg-identity.repository.js";
import { PgKnowledgeUnitOfWork } from "../rag/infrastructure/pg-knowledge-store.js";
import { PgScopeStore } from "../rag/infrastructure/pg-scope-store.js";
import { VoyageEmbeddingProvider } from "../rag/infrastructure/voyage.adapter.js";
import { createCerebroServer } from "./server.js";
import { envTokenResolver } from "./auth.js";

export function main(): void {
  const pool = new Pool({
    connectionString: requireEnv("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
  });

  const ownerResolver = new PgOwnerResolver(pool);
  const identityUow = new PgIdentityUnitOfWork(pool);
  const knowledgeUow = new PgKnowledgeUnitOfWork(pool);
  const scopeStore = new PgScopeStore(pool);
  const embedder = new VoyageEmbeddingProvider();

  const server = createCerebroServer({
    authResolver: envTokenResolver(),
    ingestDeps: { ownerResolver, uow: identityUow, knowledgeUow, embedder },
    retrieveDeps: { ownerResolver, identityUow, knowledgeUow, embedder, scopeStore },
  });

  const port = Number(process.env.PORT ?? "8080");
  server.listen(port, () => {
    console.log(`CEREBRO API escuchando en :${port}`);
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Falta la variable de entorno requerida: ${name} (va en el Vault, no en el repo).`);
  }
  return value;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main();
}
