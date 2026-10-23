/**
 * Fusión de personas duplicadas (mismo cliente, p.ej. detectado por teléfono).
 * `absorbed` queda con merged_into = survivor y sus identidades se re-apuntan a
 * survivor, de modo que cualquier resolución futura cae en el superviviente
 * (ver resolveCanonical). Determinístico; el merge por fuzzy vendrá después.
 *
 * Diseñado desde el día 1 (Arquitectura §5, §12.2): "identidad mala = cerebro
 * basura". Nunca lanza: Result<PersonId, MergeError>.
 */
import type { PersonId } from "@raisen/cerebro-contracts";
import { type Result, ok, err } from "../../shared/result.js";
import type { MergeError } from "../domain/identity.errors.js";
import type { PersonRepository } from "../domain/person-repository.port.js";

export async function mergePersons(
  repo: PersonRepository,
  survivorId: PersonId,
  absorbedId: PersonId,
): Promise<Result<PersonId, MergeError>> {
  if (survivorId === absorbedId) return err({ kind: "same_person", person_id: survivorId });

  try {
    const survivor = await repo.getPerson(survivorId);
    if (survivor === null) return err({ kind: "person_not_found", person_id: survivorId });
    const absorbed = await repo.getPerson(absorbedId);
    if (absorbed === null) return err({ kind: "person_not_found", person_id: absorbedId });

    await repo.mergePersons(survivorId, absorbedId);
    return ok(survivorId);
  } catch (e) {
    return err({ kind: "repository_error", detail: e instanceof Error ? e.message : String(e) });
  }
}
