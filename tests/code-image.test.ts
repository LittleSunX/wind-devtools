import { describe, it, expect } from "vitest";
import { highlightCode } from "../src/utils/code-highlight";
import {
  splitSegments,
  imageFilename,
  validateCode,
  languages,
  parseHighlightedLines,
  aspectRatioValue,
} from "../src/utils/code-image";
import {
  dataUrlToBase64,
  svgDataUrlToSource,
} from "../src/utils/canvas-export";
describe("code image highlighting", () => {
  it.each(languages.map(([id]) => id))(
    "preserves source text in %s",
    async (language) => {
      const code = '// 中文\nconst name = "<script> 😀";\n';
      expect(
        (await highlightCode(code, language)).map((t) => t.text).join(""),
      ).toBe(code);
    },
  );
  it.each([
    ["go", "package main\nfunc main() {}"],
    ["rust", "fn main() { let value = 1; }"],
    ["cpp", "int main() { return 0; }"],
    ["csharp", "public class Demo {}"],
    ["php", "<?php echo 'hello'; ?>"],
    ["jsx", "const view = <div>Hello</div>;"],
    ["tsx", "const view: JSX.Element = <div>Hello</div>;"],
    ["vue", "<template><h1>Hello</h1></template><script>const n = 1;</script>"],
    ["bash", "echo 'hello'"],
    ["powershell", "$name = 'hello'"],
    ["yaml", "name: hello"],
    ["toml", "name = 'hello'"],
    ["docker", "FROM node:22\nRUN echo hello"],
    ["markdown", "# Hello\n**world**"],
    ["kotlin", "fun main() { val n = 1 }"],
    ["swift", 'let name = "hello"'],
    ["ruby", "def hello\n  puts 'hello'\nend"],
  ])("recognizes native syntax in %s", async (language, code) => {
    const segments = await highlightCode(code, language);
    expect(segments.some((segment) => segment.type.length > 0)).toBe(true);
    expect(segments.map((segment) => segment.text).join("")).toBe(code);
  });
  it("assigns keyword and string colors", async () => {
    const result = await highlightCode(
      'const greeting = "hello";',
      "javascript",
    );
    expect(result.some((s) => s.type === "keyword" && s.text === "const")).toBe(
      true,
    );
    expect(result.some((s) => s.type === "string")).toBe(true);
  });
  it("preserves empty lines and normalizes line endings without changing tabs", () => {
    expect(
      splitSegments([{ text: "a\r\n\r\n\tb\r", type: "comment" }]).map((l) =>
        l.map((s) => s.text).join(""),
      ),
    ).toEqual(["a", "", "\tb", ""]);
  });
  it("rejects empty, oversized and excessively tall input", () => {
    expect(() => validateCode(" ")).toThrow();
    expect(() => validateCode("x".repeat(12001))).toThrow("12,000");
    expect(() => validateCode("a\n".repeat(160))).toThrow("160");
  });
});

it("creates a sortable local timestamp filename", () => {
  const date = new Date(2026, 8, 18, 9, 5, 2, 7);
  expect(imageFilename(date)).toBe("wind-code-20260918-090502-007.png");
  expect(imageFilename(date, "svg")).toBe("wind-code-20260918-090502-007.svg");
});

describe("advanced canvas helpers", () => {
  it("parses highlighted displayed line numbers with ranges", () => {
    expect([...parseHighlightedLines("101, 103-105, 999", 100, 6)]).toEqual([
      101, 103, 104, 105,
    ]);
  });

  it("maps aspect-ratio presets to CSS values", () => {
    expect(aspectRatioValue("1:1")).toBe("1 / 1");
    expect(aspectRatioValue("16:9")).toBe("16 / 9");
    expect(aspectRatioValue("free")).toBeUndefined();
  });
});

describe("canvas export data helpers", () => {
  it("extracts pure Base64 from a PNG data URL", () => {
    expect(dataUrlToBase64("data:image/png;base64,abc123")).toBe("abc123");
  });

  it("decodes URL-encoded SVG source", () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>Wind 中文</text></svg>';
    expect(
      svgDataUrlToSource(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`,
      ),
    ).toBe(source);
  });

  it("decodes Base64 SVG source", () => {
    const source = "<svg><text>Wind</text></svg>";
    expect(
      svgDataUrlToSource(
        `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`,
      ),
    ).toBe(source);
  });
});
