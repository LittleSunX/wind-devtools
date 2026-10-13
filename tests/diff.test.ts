import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  diffLines,
  formatUnifiedDiff,
  MAX_DIFF_BYTES,
} from "../src/utils/diff";

describe("bounded text diff and unified patches", () => {
  it("limits combined UTF-8 bytes even for a single long line", () => {
    expect(() => diffLines("x".repeat(MAX_DIFF_BYTES), "x")).toThrow("5 MiB");
    expect(() =>
      diffLines("中".repeat(Math.ceil(MAX_DIFF_BYTES / 3)), ""),
    ).toThrow("5 MiB");
  });

  it("counts physical lines without inventing a trailing empty line", () => {
    expect(diffLines("line\n", "line\n")).toEqual([
      { kind: "same", text: "line", noNewline: false, left: 1, right: 1 },
    ]);
    const text = Array.from({ length: 1200 }, (_, index) => `${index}\n`).join(
      "",
    );
    expect(diffLines(text, "")).toHaveLength(1200);
    expect(() => diffLines(text + "extra\n", "")).toThrow("1,200");
    expect(diffLines("a\r\nb\r", "a\nb\n").map((line) => line.kind)).toEqual([
      "same",
      "same",
    ]);
  });

  it("emits file headers, proper prefixes and bounded context", () => {
    const patch = formatUnifiedDiff(diffLines("a\nb\nc\n", "a\nx\nc\n"));
    expect(patch).toBe(
      "--- a/text\n+++ b/text\n@@ -1,3 +1,3 @@\n a\n-b\n+x\n c\n",
    );
    expect(formatUnifiedDiff(diffLines("same", "same"))).toBe("");
  });

  it("produces patches that git apply reconstructs exactly", async () => {
    const fixture = await mkdtemp(path.join(tmpdir(), "wind-diff-"));
    const examples = [
      ["", "inserted\n"],
      ["removed\n", ""],
      ["a\nb\nc\n", "a\nx\nc\n"],
      ["last", "last\n"],
      ["last\n", "last"],
      ["a\n\nb", "a\n\nc"],
      [
        Array.from({ length: 30 }, (_, i) => `${i}\n`).join(""),
        Array.from(
          { length: 30 },
          (_, i) => `${i === 3 || i === 25 ? `changed-${i}` : i}\n`,
        ).join(""),
      ],
    ];
    try {
      for (const [before, after] of examples) {
        await writeFile(path.join(fixture, "text"), before);
        const patch = formatUnifiedDiff(diffLines(before, after));
        const applied = spawnSync(
          "git",
          ["-c", "core.autocrlf=false", "apply", "--no-index", "-"],
          {
            cwd: fixture,
            input: patch,
            encoding: "utf8",
          },
        );
        expect(applied.status, applied.stderr).toBe(0);
        expect(await readFile(path.join(fixture, "text"), "utf8")).toBe(after);
      }
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });
});
