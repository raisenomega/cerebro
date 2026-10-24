import { describe, it, expect } from "vitest";
import { normalizeIdentity } from "./normalize.js";

describe("normalizeIdentity", () => {
  it("email -> lowercase + trim", () => {
    const r = normalizeIdentity("email", "  Cliente@Gmail.COM ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("cliente@gmail.com");
  });

  it("email inválido -> error tipado", () => {
    const r = normalizeIdentity("email", "no-es-email");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid_email");
  });

  it("phone -> E.164 quitando separadores", () => {
    const r = normalizeIdentity("phone", "+1 (787) 555-1234");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("+17875551234");
  });

  it("phone con 00 inicial -> +", () => {
    const r = normalizeIdentity("phone", "0034 600 123 456");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("+34600123456");
  });

  it("phone sin país -> inválido (no inferimos)", () => {
    const r = normalizeIdentity("phone", "555-1234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid_phone");
  });

  it("social_handle -> sin @ y lowercase", () => {
    const r = normalizeIdentity("social_handle", "@Johanny_Lopez");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("johanny_lopez");
  });

  it("local_id -> solo trim, conserva mayúsculas", () => {
    const r = normalizeIdentity("local_id", "  Nucleo_123  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("Nucleo_123");
  });

  it("valor vacío -> error", () => {
    const r = normalizeIdentity("email", "   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("empty_value");
  });
});
