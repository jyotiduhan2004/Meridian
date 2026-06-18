import { describe, it, expect } from "vitest";
import { availableInputs, runsInMode, isEligible, type SkillMeta } from "@/lib/schema";

const meta = (over: Partial<SkillMeta>): SkillMeta =>
  ({
    name: "x",
    description: "",
    specialist: "QA Engineer",
    tier: "P0",
    inputs: [],
    modes: ["idea", "product"],
    ...over,
  }) as SkillMeta;

describe("availableInputs", () => {
  it("reflects which artifacts are present", () => {
    const s = availableInputs({ url: "u", description: "d" });
    expect(s.has("url")).toBe(true);
    expect(s.has("description")).toBe(true);
    expect(s.has("repo")).toBe(false);
  });
});

describe("runsInMode", () => {
  it("respects the modes frontmatter", () => {
    expect(runsInMode(meta({ modes: ["product"] }), "idea")).toBe(false);
    expect(runsInMode(meta({ modes: ["product"] }), "product")).toBe(true);
  });
});

describe("isEligible", () => {
  it("requires all inputs present, the right mode, and a fan-out skill", () => {
    const m = meta({ inputs: ["url"], modes: ["product"] });
    expect(isEligible(m, new Set(["url"]), "product")).toBe(true);
    expect(isEligible(m, new Set<string>(), "product")).toBe(false); // missing url
    expect(isEligible(m, new Set(["url"]), "idea")).toBe(false); // wrong mode
  });
});
