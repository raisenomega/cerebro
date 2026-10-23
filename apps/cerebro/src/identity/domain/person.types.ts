/**
 * Tipos del dominio de identidad. Modelan el esquema §5 en TS; son el lenguaje
 * que la aplicación y los adaptadores comparten (ninguno acopla a Supabase).
 */
import type { IdType, PersonId } from "@raisen/cerebro-contracts";

export interface PersonRecord {
  readonly id: PersonId;
  readonly display_name: string | null;
  readonly merged_into: PersonId | null;
}

export interface PersonIdentityRecord {
  readonly id: string;
  readonly person_id: PersonId;
  readonly source_platform: string;
  readonly id_type: IdType;
  readonly id_value: string;
  readonly id_normalized: string;
  readonly confidence: number;
}

/** Cómo se resolvió la persona. */
export type ResolveStatus =
  | "hit" //    identidad existente para la plataforma que pregunta
  | "linked" // persona existente vía otra plataforma; se enlazó esta identidad
  | "created"; // persona nueva

export interface ResolveOutcome {
  readonly person_id: PersonId;
  readonly identity_id: string;
  readonly status: ResolveStatus;
}
