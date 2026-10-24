/**
 * Auth por service token (Conexion Spec §2.1): `Authorization: Bearer <token>`,
 * un token por plataforma. Mapea token -> source_platform desde las env
 * CEREBRO_SERVICE_TOKEN_<PLATAFORMA> (en el Vault). Devuelve null si no matchea.
 */
import type { SourcePlatform } from "@raisenomega/cerebro-contracts";

export type TokenPlatformResolver = (token: string) => SourcePlatform | null;

export function envTokenResolver(env: NodeJS.ProcessEnv = process.env): TokenPlatformResolver {
  const byToken = new Map<string, string>();
  for (const [key, value] of Object.entries(env)) {
    const m = /^CEREBRO_SERVICE_TOKEN_(.+)$/.exec(key);
    if (m !== null && m[1] !== undefined && value !== undefined && value !== "") {
      byToken.set(value, m[1].toLowerCase());
    }
  }
  return (token) => byToken.get(token) ?? null;
}

/** Extrae el token de un header `Authorization: Bearer <token>` (o null). */
export function bearerToken(authorization: string | undefined): string | null {
  if (authorization === undefined) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return m !== null && m[1] !== undefined ? m[1].trim() : null;
}
