# CEREBRO by raisen.dev

Capa de memoria/cognición **compartida** del ecosistema RAISEN.dev. No es un producto que corre agentes: es la libreta común que todas las plataformas alimentan y consultan.

> Los documentos internos (brief, arquitectura, estándares, decisiones) viven en `docs-hub/` y **no se commitean** (`.gitignore`). Este README es lo único público del repo.

## Qué es

- Supabase **propio dedicado** + pgvector + Voyage (`voyage-3-large`, dimensión **1024** fija).
- Guarda solo lo compartido/derivado (identidad, RAG, grafo, aprendizaje). Nunca la verdad operacional de otra plataforma.
- **Regla de oro:** CEREBRO enriquece, no bloquea. Si cae, cada plataforma sigue con su data local.

## Estructura

```
packages/
  cerebro-contracts/   # @raisen/cerebro-contracts — Slice 0: contratos compartidos
apps/
  cerebro/             # @raisen/cerebro — servicio (identity/ + rag/ + http/)
supabase/migrations/   # migraciones SQL (001 identidad, 002 knowledge_chunk)
rollback/              # .down.sql por migración
scripts/sentinel/      # gate pre-push grado bancario
docs-hub/              # documentos internos (gitignored)
```

## Estado — Slice 0 ✅

`@raisen/cerebro-contracts` define la frontera que CEREBRO y cada plataforma respetan:
- `event.contract` — envelope de evento de ingesta.
- `retrieve.contract` — request/response de `POST /cerebro/retrieve`.
- `identity.contract` — tipos del resolver de identidad.
- `cerebro-client.port` + `CerebroClientStub` — el conector (stub no-op para integrar antes de que CEREBRO exista).

## Desarrollo

```bash
pnpm install
pnpm -r build        # compila los paquetes
pnpm -r typecheck    # typecheck estricto
```

## Slice 1 — Identidad + registro de plataformas (en PR)

Identidad aislada por **negocio (owner)** con **RLS en la base** (fail-closed, sin BYPASSRLS). Migración `001` (`platform`, `owner`, `owner_platform_tenant`, `person`, `person_identity`) con su rollback, y el **resolver determinístico** (`apps/cerebro`, DDD por capas): traduce `(plataforma, tenant) → owner`, fija el contexto RLS y unifica a un `person_id` estable dentro del owner. Ver `docs-hub/CEREBRO_v1_Agent_Brief.md`.

```bash
pnpm install
pnpm -r build && pnpm -r typecheck
pnpm -r --if-present test:unit            # tests del resolver (sin DB)
DATABASE_URL=... bash scripts/test-rls.sh # test adversarial de RLS (requiere Postgres con 001 aplicada)
```

## Slice 2 — Ingesta + RAG + retrieve con scope (en PR)

API de CEREBRO para que las plataformas alimenten y consulten la memoria:
- Migración `002` (`knowledge_chunk`, `vector(1024)` Voyage, `visibility`, RLS por owner, índice ivfflat cosine; UNIQUE `(owner_id, dedup_key)` para idempotencia).
- `POST /cerebro/ingest` (202, fire-and-forget, idempotente) → resuelve persona, embebe y guarda un chunk.
- `POST /cerebro/retrieve` (200) → embebe la query, busca por similitud dentro del owner y la persona, **filtra por el scope de visibilidad del agente**. Nunca bloquea: ante fallo degrada a vacío.
- Embedding en CEREBRO (Voyage `voyage-3-large`/1024), key solo en Vault. Auth por service token (`Authorization: Bearer <token>`).

```bash
pnpm --filter @raisen/cerebro start   # levanta la API (requiere DATABASE_URL, VOYAGE_API_KEY, CEREBRO_SERVICE_TOKEN_*)
```

## Slice 3 — El loop + scope por agente (en PR)

El "ajá": una plataforma consulta y ve el historial que otra alimentó, del mismo negocio (owner), con **least-privilege por agente**.
- Migración `003` (`agent_scope`): qué visibilidades ve cada agente; **fail-closed** (agente desconocido → vacío, honest-None). Retrieve lee el scope de esta tabla.
- Seed de NÚCLEO con las formas reales (`customer_profiles`, `tenant_landing_orders`, `invoice_payments⋈invoices`); historial de órdenes = `internal` (visible), pagos = `financial`.
- E2E (en memoria): `retrieve(victor)` ve órdenes+pagos · `retrieve(eco)` sin financial · `retrieve(desconocido)` vacío.

v1 = SOLO el loop (sin grafo ni `agent_memory`/`was_correct` — fase posterior).

## Deploy (Railway)

La API se despliega en Railway leyendo TODO de variables de entorno (ver `.env.example`):
`DATABASE_URL` (pooler de Supabase, rol miembro de `cerebro_api` sin BYPASSRLS), `VOYAGE_API_KEY`, `VOYAGE_MODEL`, `VOYAGE_DIM`, `CEREBRO_SERVICE_TOKEN_*`, `PORT`.

- Build: `pnpm install --frozen-lockfile && pnpm -r build`
- Arranque: `pnpm start` (→ `pnpm --filter @raisen/cerebro start` → `node dist/http/main.js`)
- Health check (sin auth): `GET /health` → `200 {"status":"ok"}`
- Config: `railway.json` (Nixpacks + healthcheck en `/health`).

Ningún secreto vive en el repo: las llaves van al Vault de Railway.
