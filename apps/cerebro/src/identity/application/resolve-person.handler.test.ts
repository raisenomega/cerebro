import { describe, it, expect } from "vitest";
import type { IdentityRef } from "@raisen/cerebro-contracts";
import { resolvePerson } from "./resolve-person.handler.js";
import { mergePersons } from "./merge-persons.handler.js";
import { InMemoryPersonRepository } from "../infrastructure/in-memory-person-repository.js";

const email = (v: string): IdentityRef => ({ id_type: "email", id_value: v });

describe("resolvePerson — criterios §4 del brief", () => {
  it("miss: crea una persona nueva (created)", async () => {
    const repo = new InMemoryPersonRepository();
    const r = await resolvePerson(repo, "nucleo", email("a@x.com"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe("created");
  });

  it("hit: mismo identificador + misma plataforma -> mismo person_id estable", async () => {
    const repo = new InMemoryPersonRepository();
    const first = await resolvePerson(repo, "nucleo", email("a@x.com"));
    const second = await resolvePerson(repo, "nucleo", email("A@X.com")); // normaliza igual
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.person_id).toBe(first.value.person_id);
      expect(second.value.status).toBe("hit");
    }
  });

  it("mismo email desde NÚCLEO y HUB -> MISMO person_id (unifica cross-plataforma)", async () => {
    const repo = new InMemoryPersonRepository();
    const n = await resolvePerson(repo, "nucleo", email("cliente@x.com"));
    const h = await resolvePerson(repo, "hub", email("cliente@x.com"));
    expect(n.ok && h.ok).toBe(true);
    if (n.ok && h.ok) {
      expect(h.value.person_id).toBe(n.value.person_id);
      expect(h.value.status).toBe("linked");
    }
  });

  it("local_id es por plataforma: mismo valor en NÚCLEO y HUB -> personas distintas", async () => {
    const repo = new InMemoryPersonRepository();
    const n = await resolvePerson(repo, "nucleo", { id_type: "local_id", id_value: "123" });
    const h = await resolvePerson(repo, "hub", { id_type: "local_id", id_value: "123" });
    expect(n.ok && h.ok).toBe(true);
    if (n.ok && h.ok) expect(h.value.person_id).not.toBe(n.value.person_id);
  });

  it("merge vía merged_into: resolver la identidad absorbida devuelve el superviviente", async () => {
    const repo = new InMemoryPersonRepository();
    const a = await resolvePerson(repo, "nucleo", email("dup-a@x.com"));
    const b = await resolvePerson(repo, "hub", email("dup-b@x.com"));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const merged = await mergePersons(repo, a.value.person_id, b.value.person_id);
    expect(merged.ok).toBe(true);

    const again = await resolvePerson(repo, "hub", email("dup-b@x.com"));
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value.person_id).toBe(a.value.person_id);
  });

  it("merge de una persona consigo misma -> error", async () => {
    const repo = new InMemoryPersonRepository();
    const a = await resolvePerson(repo, "nucleo", email("solo@x.com"));
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const r = await mergePersons(repo, a.value.person_id, a.value.person_id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("same_person");
  });

  it("email inválido -> error tipado (no crea persona)", async () => {
    const repo = new InMemoryPersonRepository();
    const r = await resolvePerson(repo, "nucleo", email("nope"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid_email");
  });

  it("source_platform vacío -> error", async () => {
    const repo = new InMemoryPersonRepository();
    const r = await resolvePerson(repo, "   ", email("a@x.com"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("missing_source_platform");
  });
});
