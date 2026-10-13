import { describe, expect, it } from "vitest";
import { codeSamples, sampleForLanguage } from "../src/utils/code-samples";
import { languages, validateCode } from "../src/utils/code-image";
import { highlightCode } from "../src/utils/code-highlight";
describe("language examples", () => {
  it("covers every selectable language exactly once", () => {
    expect(Object.keys(codeSamples).sort()).toEqual(
      languages.map(([id]) => id).sort(),
    );
  });
  it.each(languages.map(([id]) => id))(
    "validates and highlights the %s example without losing text",
    async (language) => {
      const source = sampleForLanguage(language);
      expect(() => validateCode(source)).not.toThrow();
      expect(
        (await highlightCode(source, language))
          .map((segment) => segment.text)
          .join(""),
      ).toBe(source);
    },
  );
  it("provides valid JSON and preserves language-specific escapes", () => {
    expect(JSON.parse(codeSamples.json).name).toBe("Wind DevTools");
    expect(codeSamples.swift).toContain("\\(tool)");
    expect(codeSamples.go).toContain("%s!\\n");
    expect(codeSamples.javascript).toContain("${name}");
  });
});
