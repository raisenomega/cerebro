import { describe, it, expect } from "vitest";
import type { CerebroEvent } from "@raisenomega/cerebro-contracts";
import { computeDedupKey } from "./dedup.js";

const base: CerebroEvent = {
  event: "message.received",
  source_platform: "hub",
  tenant_id: "t1",
  occurred_at: "2026-10-23T00:00:00Z",
  identity: { id_type: "email", id_value: "a@x.com" },
  payload: { a: 1, b: 2 },
};

describe("computeDedupKey", () => {
  it("mismo evento -> misma clave", () => {
    expect(computeDedupKey({ ...base })).toBe(computeDedupKey(base));
  });

  it("el orden de las claves del payload no afecta", () => {
    const reordered: CerebroEvent = { ...base, payload: { b: 2, a: 1 } };
    expect(computeDedupKey(reordered)).toBe(computeDedupKey(base));
  });

  it("payload distinto -> clave distinta", () => {
    const other: CerebroEvent = { ...base, payload: { a: 1, b: 3 } };
    expect(computeDedupKey(other)).not.toBe(computeDedupKey(base));
  });
});
