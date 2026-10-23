/**
 * CEREBRO — Contrato de IDENTIDAD
 * ---------------------------------
 * Tipos del resolver de identidad unificada. Toda plataforma habla este
 * lenguaje para decir "quién es este cliente". El resolver de CEREBRO
 * normaliza y resuelve a un `person_id` estable.
 *
 * Fuente: RAISEN_Cerebro_Unico_Arquitectura.md v1.2 §5 · HUB_CEREBRO_Conexion_Spec §2.
 * Determinístico primero (confidence 1.0); fuzzy después (< 1.0 + revisión).
 */

/** Tipos de identificador que una plataforma puede enviar. */
export type IdType = "email" | "phone" | "social_handle" | "local_id";

/**
 * Identidad tal como la EMITE una plataforma (sin normalizar).
 * CEREBRO normaliza al resolver: email -> lowercase/trim, phone -> E.164,
 * handle -> sin '@'. `local_id` es el id del cliente en la plataforma origen.
 */
export interface IdentityRef {
  readonly id_type: IdType;
  readonly id_value: string;
  /** Id local del cliente en la plataforma que emite (opcional pero recomendado). */
  readonly local_id?: string;
}

/**
 * Identidad ya resuelta/normalizada dentro de CEREBRO.
 * `id_normalized` es la forma canónica usada para el match determinístico.
 */
export interface ResolvedIdentity {
  readonly id_type: IdType;
  readonly id_value: string;
  readonly id_normalized: string;
  /** 1.0 = match determinístico; < 1.0 = fuzzy, requiere revisión. */
  readonly confidence: number;
}

/** UUID de una persona unificada en CEREBRO. */
export type PersonId = string;
