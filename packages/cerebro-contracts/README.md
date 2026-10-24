# @raisenomega/cerebro-contracts

Contratos TypeScript del ecosistema RAISEN.dev para hablar con **CEREBRO**: tipos de identidad, eventos de ingesta, request/response de retrieve, y el puerto `cerebro-client` (+ un stub no-op). Es la frontera que CEREBRO y cada plataforma (HUB, NÚCLEO, …) respetan.

> Publicado en **GitHub Packages** (registro privado de la org `raisenomega`).

## Instalación (desde HUB u otra plataforma consumidora)

1. Crea/añade un **`.npmrc`** en la raíz del repo consumidor:
   ```
   @raisenomega:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
   ```
   `GITHUB_PACKAGES_TOKEN` es un **PAT (classic) con scope `read:packages`** (solo lectura), exportado en el entorno (no lo commitees). En CI, usa el `GITHUB_TOKEN` del repo si está en la misma org.

2. Instala:
   ```bash
   pnpm add @raisenomega/cerebro-contracts
   ```

3. Úsalo:
   ```ts
   import type { CerebroEvent, RetrieveRequest, RetrieveResponse } from "@raisenomega/cerebro-contracts";
   import { CerebroClientStub, degradedResponse } from "@raisenomega/cerebro-contracts";
   ```

## Qué exporta
- **Contratos**: `identity.contract` (IdType, IdentityRef, ResolvedIdentity, PersonId), `event.contract` (CerebroEvent, EventName, IngestAck, SourcePlatform), `retrieve.contract` (RetrieveRequest/Response, RetrievedChunk, Visibility, RequestingAgent).
- **Puerto + stub**: `CerebroClientPort`, `degradedResponse()`, `CerebroClientStub` (no-op para integrar antes de que CEREBRO exista).

## Publicación (mantenedores)
Automática al crear un tag `contracts-v*` → dispara `.github/workflows/publish-contracts.yml`, que compila y publica con el `GITHUB_TOKEN` del repo (sin PAT). Ejemplo:
```bash
git tag contracts-v0.1.0
git push origin contracts-v0.1.0
```
Sube la versión en `package.json` (`version`) antes de taggear una release nueva.
