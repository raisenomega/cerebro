/**
 * Fusión de personas duplicadas DENTRO del mismo owner (Decisión §4.6). La
 * fusión cross-owner está prohibida por diseño (son negocios distintos).
 * `absorbed` queda con merged_into = survivor y sus identidades se re-apuntan,
 * de modo que cualquier resolución futura cae en el superviviente.
 * Nunca lanza: Result<PersonId, MergeError>.
 */
import type { PersonId } from "@raisenomega/cerebro-contracts";
import { type Result, ok, err } from "../../shared/result.js";
import type { MergeError } from "../domain/identity.errors.js";
import type { OwnerId } from "../domain/person.types.js";
import type { IdentityUnitOfWork } from "../domain/person-repository.port.js";

export async function mergePersons(
  uow: IdentityUnitOfWork,
  ownerId: OwnerId,
  survivorId: PersonId,
  absorbedId: PersonId,
): Promise<Result<PersonId, MergeError>> {
  if (survivorId === absorbedId) return err({ kind: "same_person", person_id: survivorId });

  try {
    return await uow.withOwner(ownerId, async (store) => {
      const survivor = await store.getPerson(ownerId, survivorId);
      if (survivor === null) return err({ kind: "person_not_found", person_id: survivorId });
      const absorbed = await store.getPerson(ownerId, absorbedId);
      if (absorbed === null) return err({ kind: "person_not_found", person_id: absorbedId });

      await store.mergePersons(ownerId, survivorId, absorbedId);
      return ok(survivorId);
    });
  } catch (e) {
    return err({ kind: "repository_error", detail: e instanceof Error ? e.message : String(e) });
  }
}
