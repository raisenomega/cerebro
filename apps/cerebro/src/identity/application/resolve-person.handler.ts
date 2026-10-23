/**
 * Resolver determinístico de identidad por NEGOCIO (owner).
 * Flujo (CEREBRO_Decision_Identidad_Tenant.md §4):
 *   1-2. Traducir (source_platform, tenant_id) -> owner_id. Sin mapeo => rechazar
 *        (fail-closed, `unknown_tenant`).
 *   3.   Fijar contexto de owner (RLS) vía la unidad de trabajo.
 *   4.   Normalizar (email lowercase/trim · phone E.164 · handle sin @ · local_id tal cual).
 *   5.   Buscar person_identity por (owner_id, id_type, id_normalized). Hit =>
 *        person_id (siguiendo merged_into). Miss => crear person (owner) + identidad.
 *
 * El aislamiento vive en la BASE (RLS), no aquí: el resolver NO corre con
 * BYPASSRLS. Nunca lanza: Result<ResolveOutcome, ResolveError>. confidence = 1.0.
 */
import type { IdentityRef, PersonId } from "@raisen/cerebro-contracts";
import { type Result, ok, err, isErr } from "../../shared/result.js";
import type { ResolveError } from "../domain/identity.errors.js";
import type { OwnerId, ResolveOutcome, ResolveStatus } from "../domain/person.types.js";
import { normalizeIdentity } from "../domain/normalize.js";
import type {
  IdentityStore,
  IdentityUnitOfWork,
  OwnerResolver,
} from "../domain/person-repository.port.js";

const DETERMINISTIC_CONFIDENCE = 1.0;

export interface ResolveDeps {
  readonly ownerResolver: OwnerResolver;
  readonly uow: IdentityUnitOfWork;
}

export interface ResolveInput {
  readonly sourcePlatform: string;
  readonly tenantId: string;
  readonly ref: IdentityRef;
  readonly displayName?: string | null;
}

export async function resolvePerson(
  deps: ResolveDeps,
  input: ResolveInput,
): Promise<Result<ResolveOutcome, ResolveError>> {
  const sourcePlatform = input.sourcePlatform.trim();
  const tenantId = input.tenantId.trim();
  if (sourcePlatform === "") return err({ kind: "missing_source_platform" });
  if (tenantId === "") return err({ kind: "missing_tenant_id" });

  try {
    // 1-2. Traducir tenant -> owner (fail-closed antes de tocar identidad).
    const ownerId = await deps.ownerResolver.resolveOwnerId(sourcePlatform, tenantId);
    if (ownerId === null) {
      return err({ kind: "unknown_tenant", source_platform: sourcePlatform, tenant_id: tenantId });
    }

    // 4. Normalizar.
    const normalized = normalizeIdentity(input.ref.id_type, input.ref.id_value);
    if (isErr(normalized)) return normalized;
    const idNormalized = normalized.value;

    // 3 + 5. Contexto de owner (RLS) y buscar/crear scoped.
    return await deps.uow.withOwner(ownerId, async (store) => {
      const existing = await store.findIdentity(ownerId, {
        id_type: input.ref.id_type,
        id_normalized: idNormalized,
      });
      if (existing !== null) {
        const canonical = await resolveCanonical(store, ownerId, existing.person_id);
        return ok({
          owner_id: ownerId,
          person_id: canonical,
          identity_id: existing.id,
          status: "hit",
        });
      }

      const person = await store.createPerson(ownerId, input.displayName ?? null);
      const identity = await store.insertIdentity({
        owner_id: ownerId,
        person_id: person.id,
        source_platform: sourcePlatform,
        id_type: input.ref.id_type,
        id_value: input.ref.id_value,
        id_normalized: idNormalized,
        confidence: DETERMINISTIC_CONFIDENCE,
      });
      // insertIdentity es idempotente: si una carrera ganó, devuelve su fila y
      // person_id puede diferir del recién creado (quedaría una person huérfana;
      // limpieza documentada como deuda).
      const status: ResolveStatus = identity.person_id === person.id ? "created" : "hit";
      return ok({
        owner_id: ownerId,
        person_id: identity.person_id,
        identity_id: identity.id,
        status,
      });
    });
  } catch (e) {
    return err({ kind: "repository_error", detail: errorMessage(e) });
  }
}

/** Sigue la cadena merged_into hasta la persona superviviente (con tope anti-ciclo). */
async function resolveCanonical(
  store: IdentityStore,
  ownerId: OwnerId,
  start: PersonId,
): Promise<PersonId> {
  const seen = new Set<PersonId>();
  let current: PersonId = start;
  while (!seen.has(current)) {
    seen.add(current);
    const person = await store.getPerson(ownerId, current);
    if (person === null || person.merged_into === null) return current;
    current = person.merged_into;
  }
  return current;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
