import { describe, it, expect } from "vitest";
import { extractInputs } from "@/lib/intake";

describe("extractInputs", () => {
  it("pulls a github repo + a separate deployed url + description", () => {
    const r = extractInputs(
      "Check out https://github.com/me/proj deployed at https://proj.vercel.app — a todo app",
    );
    expect(r.repo).toBe("https://github.com/me/proj");
    expect(r.url).toBe("https://proj.vercel.app");
    expect(r.description).toContain("todo app");
  });

  it("treats a github url as repo, not url", () => {
    const r = extractInputs("https://github.com/me/proj");
    expect(r.repo).toBe("https://github.com/me/proj");
    expect(r.url).toBeUndefined();
  });

  it("returns no repo/url for plain text", () => {
    const r = extractInputs("a habit tracker for students");
    expect(r.repo).toBeUndefined();
    expect(r.url).toBeUndefined();
    expect(r.description).toBe("a habit tracker for students");
  });
});
