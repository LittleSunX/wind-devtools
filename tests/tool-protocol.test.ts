import { describe, expect, it } from "vitest";
import {
  createToolRequest,
  type AppOptions,
  type ToolRequest,
} from "../src/utils/shared";
import { canvasReadiness } from "../src/utils/canvas-readiness";
import { defaults } from "../src/utils/code-image";

const options: AppOptions = {
  indent: "2",
  dialect: "mysql",
  keyword: "upper",
  unit: "ms",
  zone: "UTC",
  direction: "timestamp",
  mode: "quartz",
  codec: "base64",
  codecDirection: "encode",
  textAction: "dedupe",
  target: "typescript",
  rootName: "Root",
  prefix: "",
  suffix: "",
};

describe("tool worker protocol", () => {
  it("sends only fields relevant to each tool", () => {
    const request = createToolRequest("json", "{}", options, "minify", "en");
    expect(request).toEqual({
      id: "json",
      input: "{}",
      language: "en",
      options: { action: "minify", indent: "2" },
    } satisfies ToolRequest);
    expect(createToolRequest("jwt", "a.b.c", options).options).toEqual({});
    expect(createToolRequest("timestamp", "123", options).options).toEqual({
      direction: "timestamp",
      unit: "ms",
      zone: "UTC",
    });
  });
});

describe("canvas export readiness", () => {
  const code = "const value = 1;";
  const size = {
    width: 720,
    height: 420,
    overflow: false,
    code,
    options: defaults,
  };
  const ready = {
    code,
    options: defaults,
    size,
    autoWidth: 720,
    highlighted: true,
    fontReady: defaults.fontFamily,
    fontError: "",
    highlightError: "",
  };
  it("blocks export until code, font, highlight and measurement match", () => {
    expect(canvasReadiness(ready).canExport).toBe(true);
    expect(canvasReadiness({ ...ready, code: "changed" }).canExport).toBe(
      false,
    );
    expect(canvasReadiness({ ...ready, highlighted: false }).canExport).toBe(
      false,
    );
    expect(canvasReadiness({ ...ready, fontReady: "" }).canExport).toBe(false);
    expect(canvasReadiness({ ...ready, autoWidth: 800 }).canExport).toBe(false);
  });
  it("blocks oversized images with an actionable error", () => {
    const result = canvasReadiness({
      ...ready,
      size: { ...size, width: 3000, height: 3000 },
    });
    expect(result.canExport).toBe(false);
    expect(result.error).toContain("宽度");
  });
  it("allows SVG and recovery when only PNG scale exceeds the pixel budget", () => {
    const options = {
      ...defaults,
      widthMode: "fixed" as const,
      width: 800,
      scale: 3,
    };
    const input = {
      ...ready,
      options,
      size: { ...size, width: 800, height: 2600, options },
    };
    const oversized = canvasReadiness(input);
    expect(oversized.canExport).toBe(false);
    expect(oversized.canExportSvg).toBe(true);
    expect(oversized.pngError).toContain("倍率");
    const reduced = { ...options, scale: 2 };
    expect(
      canvasReadiness({
        ...input,
        options: reduced,
        size: { ...input.size, options: reduced },
      }).canExport,
    ).toBe(true);
  });
});
