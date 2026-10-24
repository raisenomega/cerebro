import { describe, it, expect } from "vitest";
import { agentVisibilityScope } from "./scope.js";

describe("agentVisibilityScope", () => {
  it("por defecto solo public+internal (deny-by-default sobre lo sensible)", () => {
    const s = agentVisibilityScope("victor");
    expect([...s].sort()).toEqual(["internal", "public"]);
    expect(s).not.toContain("financial");
    expect(s).not.toContain("pii_sensitive");
  });

  it("un agente desconocido también cae al default conservador", () => {
    expect([...agentVisibilityScope("agente-x")].sort()).toEqual(["internal", "public"]);
  });
});
