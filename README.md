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
  cerebro/             # @raisen/cerebro — servicio (Slice 1: dominio de identidad)
supabase/migrations/   # migraciones SQL (001: identidad + plataformas)
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

Supabase propio, migración `001` (`platform`, `person`, `person_identity`, RLS, índice de lookup) con su rollback, y el **resolver determinístico** (`apps/cerebro`, DDD por capas) que unifica a un `person_id` estable. Ver `docs-hub/CEREBRO_v1_Agent_Brief.md`.

```bash
pnpm install
pnpm -r build && pnpm -r typecheck
pnpm -r --if-present test:unit            # tests del resolver (sin DB)
DATABASE_URL=... bash scripts/test-rls.sh # test adversarial de RLS (requiere Postgres con 001 aplicada)
```
