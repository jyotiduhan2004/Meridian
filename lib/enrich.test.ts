import { describe, it, expect } from "vitest";
import { urlFromText, weakDescription } from "@/lib/enrich";

describe("urlFromText", () => {
  it("finds an explicit http url, skipping github", () => {
    expect(urlFromText("repo https://github.com/a/b and site https://app.acme.dev")).toBe(
      "https://app.acme.dev",
    );
  });

  it("finds a bare domain written in prose", () => {
    expect(urlFromText("the deployed url is myapp.io")).toBe("https://myapp.io");
  });

  it("returns undefined when there's no app url", () => {
    expect(urlFromText("just a plain description with no link")).toBeUndefined();
  });
});

describe("weakDescription", () => {
  it("treats empty / short / instruction-like text as weak", () => {
    expect(weakDescription(undefined)).toBe(true);
    expect(weakDescription("analyse this")).toBe(true);
    expect(weakDescription("review it")).toBe(true);
  });

  it("treats a real, substantive description as strong", () => {
    expect(
      weakDescription(
        "A voice-first AI interior designer that scans your room and generates photorealistic redesigns with shoppable product links.",
      ),
    ).toBe(false);
  });
});
