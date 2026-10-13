import Prism from "prismjs";
import { describe, expect, it } from "vitest";
import { highlightCode } from "../src/utils/code-highlight";

describe("lazy syntax grammars", () => {
  it("loads only the selected grammar and its prerequisites", async () => {
    expect(Prism.languages.tsx).toBeUndefined();
    expect(Prism.languages.php).toBeUndefined();
    expect(Prism.languages.python).toBeUndefined();
    expect(await highlightCode("const text = 1;", "plain")).toEqual([
      { text: "const text = 1;", type: "" },
    ]);
    expect(Prism.languages.typescript).toBeUndefined();
    const code = "const view: JSX.Element = <div>Hello</div>;";
    expect((await highlightCode(code, "tsx")).map((s) => s.text).join("")).toBe(
      code,
    );
    expect(Prism.languages.typescript).toBeDefined();
    expect(Prism.languages.jsx).toBeDefined();
    expect(Prism.languages.tsx).toBeDefined();
    expect(Prism.languages.php).toBeUndefined();
    expect(Prism.languages.python).toBeUndefined();
  });

  it("loads PHP templating and C++ prerequisites before tokenizing", async () => {
    await highlightCode("<?php echo 'hello'; ?>", "php");
    expect(Prism.languages["markup-templating"]).toBeDefined();
    expect(Prism.languages.php).toBeDefined();
    await highlightCode("int main() { return 0; }", "cpp");
    expect(Prism.languages.c).toBeDefined();
    expect(Prism.languages.cpp).toBeDefined();
  });

  it("rejects unsupported languages without silently returning plain text", async () => {
    await expect(highlightCode("source", "unknown")).rejects.toThrow(
      "暂不支持该语言",
    );
  });
});
