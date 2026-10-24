import { describe, it, expect } from "vitest";
import type { IdentityRef } from "@raisen/cerebro-contracts";
import { resolvePerson, type ResolveDeps } from "./resolve-person.handler.js";
import { mergePersons } from "./merge-persons.handler.js";
import {
  InMemoryOwnerResolver,
  InMemoryIdentityUnitOfWork,
} from "../infrastructure/in-memory-identity.js";

const OWNER_A = "owner-a";
const OWNER_B = "owner-b";

/** Dos negocios; el A tiene tenants en nucleo y hub, el B solo en nucleo. */
function makeDeps(): ResolveDeps {
  const ownerResolver = new InMemoryOwnerResolver()
    .register("nucleo", "tenant-A", OWNER_A)
    .register("hub", "tenant-A-hub", OWNER_A)
    .register("nucleo", "tenant-B", OWNER_B);
  const uow = new InMemoryIdentityUnitOfWork();
  return { ownerResolver, uow };
}

const email = (v: string): IdentityRef => ({ id_type: "email", id_value: v });

describe("resolvePerson — modelo owner (Decisión de cimiento §6)", () => {
  it("fail-closed: tenant sin mapeo -> unknown_tenant (no crea nada)", async () => {
    const r = await resolvePerson(makeDeps(), {
      sourcePlatform: "nucleo",
      tenantId: "tenant-desconocido",
      ref: email("a@x.com"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("unknown_tenant");
  });

  it("miss: crea una persona nueva (created) bajo el owner correcto", async () => {
    const r = await resolvePerson(makeDeps(), {
      sourcePlatform: "nucleo",
      tenantId: "tenant-A",
      ref: email("a@x.com"),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.status).toBe("created");
      expect(r.value.owner_id).toBe(OWNER_A);
    }
  });

  it("hit: mismo identificador + mismo tenant -> mismo person_id estable", async () => {
    const d = makeDeps();
    const first = await resolvePerson(d, { sourcePlatform: "nucleo", tenantId: "tenant-A", ref: email("a@x.com") });
    const second = await resolvePerson(d, { sourcePlatform: "nucleo", tenantId: "tenant-A", ref: email("A@X.com") });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.person_id).toBe(first.value.person_id);
      expect(second.value.status).toBe("hit");
    }
  });

  it('el "ajá": mismo email por NÚCLEO y HUB del MISMO owner -> MISMO person_id', async () => {
    const d = makeDeps();
    const n = await resolvePerson(d, { sourcePlatform: "nucleo", tenantId: "tenant-A", ref: email("cliente@x.com") });
    const h = await resolvePerson(d, { sourcePlatform: "hub", tenantId: "tenant-A-hub", ref: email("cliente@x.com") });
    expect(n.ok && h.ok).toBe(true);
    if (n.ok && h.ok) {
      expect(h.value.person_id).toBe(n.value.person_id);
      expect(h.value.owner_id).toBe(OWNER_A);
      expect(h.value.status).toBe("hit");
    }
  });

  it("aislamiento: mismo email en owner A y owner B -> person_id DISTINTOS", async () => {
    const d = makeDeps();
    const a = await resolvePerson(d, { sourcePlatform: "nucleo", tenantId: "tenant-A", ref: email("shared@x.com") });
    const b = await resolvePerson(d, { sourcePlatform: "nucleo", tenantId: "tenant-B", ref: email("shared@x.com") });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.person_id).not.toBe(b.value.person_id);
      expect(a.value.owner_id).toBe(OWNER_A);
      expect(b.value.owner_id).toBe(OWNER_B);
    }
  });

  it("merge dentro del owner: resolver la identidad absorbida devuelve el superviviente", async () => {
    const d = makeDeps();
    const a = await resolvePerson(d, { sourcePlatform: "nucleo", tenantId: "tenant-A", ref: email("dup-a@x.com") });
    const b = await resolvePerson(d, { sourcePlatform: "hub", tenantId: "tenant-A-hub", ref: email("dup-b@x.com") });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const merged = await mergePersons(d.uow, OWNER_A, a.value.person_id, b.value.person_id);
    expect(merged.ok).toBe(true);

    const again = await resolvePerson(d, { sourcePlatform: "hub", tenantId: "tenant-A-hub", ref: email("dup-b@x.com") });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value.person_id).toBe(a.value.person_id);
  });

  it("merge de una persona consigo misma -> error", async () => {
    const d = makeDeps();
    const a = await resolvePerson(d, { sourcePlatform: "nucleo", tenantId: "tenant-A", ref: email("solo@x.com") });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const r = await mergePersons(d.uow, OWNER_A, a.value.person_id, a.value.person_id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("same_person");
  });

  it("email inválido -> error tipado (tenant válido)", async () => {
    const r = await resolvePerson(makeDeps(), {
      sourcePlatform: "nucleo",
      tenantId: "tenant-A",
      ref: email("nope"),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid_email");
  });

  it("source_platform vacío -> error", async () => {
    const r = await resolvePerson(makeDeps(), { sourcePlatform: "  ", tenantId: "tenant-A", ref: email("a@x.com") });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("missing_source_platform");
  });

  it("tenant_id vacío -> error", async () => {
    const r = await resolvePerson(makeDeps(), { sourcePlatform: "nucleo", tenantId: "", ref: email("a@x.com") });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("missing_tenant_id");
  });
});
