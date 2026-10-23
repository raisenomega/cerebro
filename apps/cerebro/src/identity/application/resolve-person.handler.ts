/**
 * Resolver determinístico de identidad (Arquitectura §5).
 *   1. Normaliza (email lowercase/trim · phone E.164 · handle sin @).
 *   2. Busca en person_identity:
 *        - global (email/phone/handle): por (id_type, id_normalized) — unifica
 *          cross-plataforma (mismo email en NÚCLEO y HUB => misma person).
 *        - local_id: acotado a (source_platform, id_type, id_normalized).
 *   3. Hit -> person_id (siguiendo la cadena merged_into). Miss -> crea person
 *      + registra la identidad.
 *   4. Enlaza la identidad de ESTA plataforma si la persona ya existía vía otra.
 *
 * Nunca lanza: devuelve Result<ResolveOutcome, ResolveError>. Determinístico,
 * confidence = 1.0 (el fuzzy será < 1.0 + revisión, en una fase posterior).
 */
import type { IdentityRef, IdType, PersonId } from "@raisen/cerebro-contracts";
import { type Result, ok, err, isErr } from "../../shared/result.js";
import type { ResolveError } from "../domain/identity.errors.js";
import type { ResolveOutcome } from "../domain/person.types.js";
import { normalizeIdentity } from "../domain/normalize.js";
import type { IdentityLookup, PersonRepository } from "../domain/person-repository.port.js";

const DETERMINISTIC_CONFIDENCE = 1.0;

/** Los globales matchean cross-plataforma; `local_id` es por plataforma. */
function isGlobalIdType(idType: IdType): boolean {
  return idType !== "local_id";
}

export async function resolvePerson(
  repo: PersonRepository,
  sourcePlatform: string,
  ref: IdentityRef,
  displayName: string | null = null,
): Promise<Result<ResolveOutcome, ResolveError>> {
  if (sourcePlatform.trim() === "") return err({ kind: "missing_source_platform" });

  const normalized = normalizeIdentity(ref.id_type, ref.id_value);
  if (isErr(normalized)) return normalized;
  const idNormalized = normalized.value;

  try {
    const lookup: IdentityLookup = isGlobalIdType(ref.id_type)
      ? { id_type: ref.id_type, id_normalized: idNormalized }
      : { id_type: ref.id_type, id_normalized: idNormalized, source_platform: sourcePlatform };

    const existing = await repo.findIdentity(lookup);

    if (existing) {
      const canonicalId = await resolveCanonical(repo, existing.person_id);
      if (existing.source_platform === sourcePlatform) {
        return ok({ person_id: canonicalId, identity_id: existing.id, status: "hit" });
      }
      // Persona conocida vía otra plataforma: asegura la fila de ESTA plataforma.
      const linked = await repo.insertIdentity({
        person_id: canonicalId,
        source_platform: sourcePlatform,
        id_type: ref.id_type,
        id_value: ref.id_value,
        id_normalized: idNormalized,
        confidence: DETERMINISTIC_CONFIDENCE,
      });
      return ok({ person_id: canonicalId, identity_id: linked.id, status: "linked" });
    }

    // Miss: nueva persona + su primera identidad.
    const person = await repo.createPerson(displayName);
    const identity = await repo.insertIdentity({
      person_id: person.id,
      source_platform: sourcePlatform,
      id_type: ref.id_type,
      id_value: ref.id_value,
      id_normalized: idNormalized,
      confidence: DETERMINISTIC_CONFIDENCE,
    });
    // Carrera: insertIdentity es idempotente; si otro proceso ganó, devuelve su
    // fila y person_id puede diferir del recién creado (quedaría una person
    // huérfana — limpieza marcada como deuda en current-state.md).
    const status = identity.person_id === person.id ? "created" : "linked";
    return ok({ person_id: identity.person_id, identity_id: identity.id, status });
  } catch (e) {
    return err({ kind: "repository_error", detail: errorMessage(e) });
  }
}

/** Sigue la cadena merged_into hasta la persona superviviente (con tope anti-ciclo). */
async function resolveCanonical(repo: PersonRepository, start: PersonId): Promise<PersonId> {
  const seen = new Set<PersonId>();
  let current: PersonId = start;
  while (!seen.has(current)) {
    seen.add(current);
    const person = await repo.getPerson(current);
    if (person === null || person.merged_into === null) return current;
    current = person.merged_into;
  }
  return current;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
