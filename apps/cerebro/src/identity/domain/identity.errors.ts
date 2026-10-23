/**
 * Errores tipados del dominio de identidad. Discriminados por `kind` para que
 * el borde (API/ingester) los mapee a HTTP/log sin `catch` sin tipo.
 */
import type { IdType } from "@raisen/cerebro-contracts";

export type NormalizeError =
  | { readonly kind: "empty_value"; readonly id_type: IdType }
  | { readonly kind: "invalid_email"; readonly value: string }
  | { readonly kind: "invalid_phone"; readonly value: string }
  | { readonly kind: "invalid_handle"; readonly value: string };

export type ResolveError =
  | NormalizeError
  | { readonly kind: "missing_source_platform" }
  | { readonly kind: "repository_error"; readonly detail: string };

export type MergeError =
  | { readonly kind: "same_person"; readonly person_id: string }
  | { readonly kind: "person_not_found"; readonly person_id: string }
  | { readonly kind: "repository_error"; readonly detail: string };
