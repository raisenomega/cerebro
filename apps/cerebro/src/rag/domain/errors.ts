/**
 * Errores tipados de la ingesta. (El retrieve NO devuelve error: ante cualquier
 * fallo degrada a una respuesta vacía — "enriquece, no bloquea".)
 */
export type IngestError =
  | { readonly kind: "missing_source_platform" }
  | { readonly kind: "missing_tenant_id" }
  | { readonly kind: "unknown_tenant"; readonly source_platform: string; readonly tenant_id: string }
  | { readonly kind: "invalid_identity"; readonly detail: string }
  | { readonly kind: "empty_content" }
  | { readonly kind: "embedding_failed"; readonly detail: string }
  | { readonly kind: "repository_error"; readonly detail: string };
