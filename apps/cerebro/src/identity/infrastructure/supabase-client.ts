/**
 * Cliente Supabase con service_role (BYPASSRLS) para el resolver/ingester.
 * La key vive en el Vault (env SUPABASE_SERVICE_ROLE_KEY), NUNCA en código.
 * Falla temprano si falta — es un invariante de arranque, no control de flujo.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(
  url: string = requireEnv("SUPABASE_URL"),
  serviceRoleKey: string = requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `Falta la variable de entorno requerida: ${name} (va en el Vault, no en el repo).`,
    );
  }
  return value;
}
