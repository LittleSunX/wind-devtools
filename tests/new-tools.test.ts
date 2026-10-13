import { describe, expect, it } from "vitest";
import { codecTool } from "../src/utils/codec";
import { textTool } from "../src/utils/text";
import { jsonTypeTool } from "../src/utils/json-type";
import { diffLines, formatUnifiedDiff } from "../src/utils/diff";

describe("codec tool", () => {
  it("round-trips UTF-8 Base64", () => {
    const encoded = codecTool("Wind 中文 😀", {
      codec: "base64",
      codecDirection: "encode",
    });
    expect(
      codecTool(encoded, { codec: "base64", codecDirection: "decode" }),
    ).toBe("Wind 中文 😀");
  });

  it("encodes and decodes URL components", () => {
    const encoded = codecTool("a b/中文?x=1&y=2", {
      codec: "url",
      codecDirection: "encode",
    });
    expect(encoded).toContain("%");
    expect(codecTool(encoded, { codec: "url", codecDirection: "decode" })).toBe(
      "a b/中文?x=1&y=2",
    );
  });

  it("preserves unescaped whitespace when decoding URL components", () => {
    expect(
      codecTool(" \tWind%20DevTools\n ", {
        codec: "url",
        codecDirection: "decode",
      }),
    ).toBe(" \tWind DevTools\n ");
  });

  it("rejects malformed encoded input", () => {
    expect(() =>
      codecTool("%%%", { codec: "url", codecDirection: "decode" }),
    ).toThrow("URL");
    expect(() =>
      codecTool("***", { codec: "base64", codecDirection: "decode" }),
    ).toThrow("Base64");
  });
});

describe("batch text tool", () => {
  it("deduplicates while preserving first occurrence", () => {
    expect(textTool("b\na\nb\na\nc", { textAction: "dedupe" })).toBe("b\na\nc");
  });

  it("trims, removes blanks and adds affixes", () => {
    expect(textTool(" a \n  \nb ", { textAction: "trim-lines" })).toBe(
      "a\n\nb",
    );
    expect(textTool("a\n \nb", { textAction: "remove-empty" })).toBe("a\nb");
    expect(textTool("a\nb", { textAction: "prefix", prefix: "- " })).toBe(
      "- a\n- b",
    );
    expect(textTool("a\nb", { textAction: "suffix", suffix: ";" })).toBe(
      "a;\nb;",
    );
  });
});

describe("JSON to type", () => {
  const input =
    '{"id":1001,"name":"Wind","active":true,"profile":{"city":"Shanghai"},"tags":["dev"]}';

  it("generates TypeScript interfaces", () => {
    const result = jsonTypeTool(input, {
      target: "typescript",
      rootName: "User",
    });
    expect(result).toContain("export interface User");
    expect(result).toContain('"profile": UserProfile;');
    expect(result).toContain("export interface UserProfile");
    expect(result).toContain('"tags": string[];');
  });

  it("generates Java classes without invalid top-level static classes", () => {
    const result = jsonTypeTool(input, { target: "java", rootName: "User" });
    expect(result).toContain("public class User");
    expect(result).toContain("private UserProfile profile;");
    expect(result).toContain("class UserProfile");
    expect(result).not.toContain("public static class");
  });

  it("handles root arrays without self-referential aliases", () => {
    const ts = jsonTypeTool('[{"id":1}]', {
      target: "typescript",
      rootName: "Users",
    });
    expect(ts).toContain("export type Users = UsersItem[];");
    expect(ts).toContain("export interface UsersItem");

    const java = jsonTypeTool('[{"id":1}]', {
      target: "java",
      rootName: "Users",
    });
    expect(java).toContain("private List<UsersItem> value;");
    expect(java).toContain("class UsersItem");
  });
});

describe("text diff", () => {
  it("marks unchanged, removed and added lines", () => {
    const result = diffLines("a\nb\nc", "a\nx\nc");
    expect(result.map((line) => [line.kind, line.text])).toEqual([
      ["same", "a"],
      ["remove", "b"],
      ["add", "x"],
      ["same", "c"],
    ]);
    expect(formatUnifiedDiff(result)).toContain("-b");
    expect(formatUnifiedDiff(result)).toContain("+x");
  });

  it("protects the browser from very large line matrices", () => {
    const text = Array.from({ length: 1201 }, (_, index) => String(index)).join(
      "\n",
    );
    expect(() => diffLines(text, "x")).toThrow("1,200");
  });
});
