/**
 * Tipos del dominio de identidad (modelo owner). Reflejan el esquema de
 * CEREBRO_Decision_Identidad_Tenant.md en TS; son el lenguaje que la aplicación
 * y los adaptadores comparten. `owner` es interno de CEREBRO (no viaja en los
 * contratos de Slice 0).
 */
import type { IdType, PersonId } from "@raisenomega/cerebro-contracts";

/** UUID del negocio a nivel CEREBRO. El aislamiento de identidad es por owner. */
export type OwnerId = string;

export interface OwnerRecord {
  readonly id: OwnerId;
  readonly name: string;
}

export interface PersonRecord {
  readonly id: PersonId;
  readonly owner_id: OwnerId;
  readonly display_name: string | null;
  readonly merged_into: PersonId | null;
}

export interface PersonIdentityRecord {
  readonly id: string;
  readonly owner_id: OwnerId;
  readonly person_id: PersonId;
  /** Procedencia (de qué plataforma vino). NO forma parte de la llave de unicidad. */
  readonly source_platform: string;
  readonly id_type: IdType;
  readonly id_value: string;
  readonly id_normalized: string;
  readonly confidence: number;
}

/** Cómo se resolvió la persona dentro del owner. */
export type ResolveStatus = "hit" | "created";

export interface ResolveOutcome {
  readonly owner_id: OwnerId;
  readonly person_id: PersonId;
  readonly identity_id: string;
  readonly status: ResolveStatus;
}
