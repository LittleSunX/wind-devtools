import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { canvasTools } from "./canvas-test-utils.mjs";

const base = process.env.TEST_URL || "http://localhost:4173";
const browser = await chromium.launch({
  channel: process.env.PW_CHANNEL === "bundled" ? undefined : "chrome",
});
await mkdir("artifacts", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    locale: "zh-CN",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/tools/code-image");
  const tools = canvasTools(page);
  await tools.ready();
  const initialDimensions = await tools.dimensions();
  assert.ok(
    initialDimensions.w >= 800,
    "the default artwork must not remain a small thumbnail on desktop",
  );
  const initialScale = await tools.artwork.evaluate(
    (element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a,
  );
  assert.equal(
    initialScale,
    1,
    "the default desktop code must remain at its readable native size",
  );
  await page.getByRole("button", { name: "外观设置", exact: true }).click();
  await page.getByRole("tab", { name: "窗口", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "编辑器", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("字体", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "布局", exact: true }).click();
  await page.getByLabel("宽度模式", { exact: true }).selectOption("fixed");
  await page.getByLabel("画布宽度", { exact: true }).selectOption("800");
  await tools.close();
  await tools.scale(3);
  await tools.editor.fill(
    Array.from({ length: 150 }, (_, i) => `console.log("line ${i + 1}");`).join(
      "\n",
    ),
  );
  assert.equal(
    await tools.artwork.evaluate(
      (element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a,
    ),
    initialScale,
    "long code must scroll instead of shrinking to fit its height",
  );
  assert.ok(
    await page
      .locator(".canvas-stage")
      .evaluate((element) => element.scrollHeight > element.clientHeight),
  );
  await expect(page.getByRole("alert")).toContainText("图片尺寸过大");
  await expect(
    page.getByRole("button", { name: "快速下载 PNG", exact: true }),
  ).toBeDisabled();
  await expect(tools.download).toBeEnabled();
  let menu = await tools.openPopover(tools.download);
  await expect(
    menu.getByRole("button", { name: "下载 PNG", exact: true }),
  ).toBeDisabled();
  await expect(
    menu.getByRole("button", { name: "下载 SVG", exact: true }),
  ).toBeEnabled();
  const svgEvent = page.waitForEvent("download");
  await menu.getByRole("button", { name: "下载 SVG", exact: true }).click();
  const svg = await svgEvent;
  assert.match(await readFile(await svg.path(), "utf8"), /<svg/);
  menu = await tools.openPopover(tools.download);
  await menu.getByRole("button", { name: "2×", exact: true }).click();
  await tools.close();
  await tools.ready();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const pngEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "快速下载 PNG", exact: true }).click();
  const png = await pngEvent;
  const bytes = await readFile(await png.path());
  assert.equal(bytes.readUInt32BE(16), 1600);
  assert.ok(bytes.readUInt32BE(20) > 7000);

  // Windows line endings remain consistent between the editor and find offsets.
  await tools.editor.fill("short sample");
  const fileMenu = await tools.openPopover(
    page.getByRole("button", { name: "代码操作", exact: true }),
  );
  await fileMenu.locator('input[type="file"]').setInputFiles({
    name: "example.ts",
    mimeType: "text/plain",
    buffer: Buffer.from("first\r\nsecond\r\nneedle\r\n"),
  });
  await expect(tools.editor).toHaveValue("first\nsecond\nneedle\n");
  await tools.editor.press("Control+f");
  await page.getByLabel("查找内容", { exact: true }).fill("needle");
  await page.getByRole("button", { name: "下一个", exact: true }).click();
  assert.equal(
    await tools.editor.evaluate((element) =>
      element.value.slice(element.selectionStart, element.selectionEnd),
    ),
    "needle",
  );
  await page.getByRole("button", { name: "关闭查找", exact: true }).click();
  await tools.ready();
  await page.screenshot({ path: "artifacts/canvas-workbench-desktop.png" });
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "外观设置", exact: true }).click();
    await page.getByRole("tab", { name: "编辑器", exact: true }).click();
    await expect(page.getByLabel("字号", { exact: true })).toBeVisible();
    await page.screenshot({ path: `artifacts/canvas-workbench-${width}.png` });
    await tools.close();
  }
  await page.goto(base + "/tools/text");
  await page.getByLabel("处理方式", { exact: true }).selectOption("trim-lines");
  await page.getByLabel("输入", { exact: true }).fill(" ");
  await page.getByRole("button", { name: "处理", exact: true }).click();
  await expect(
    page.getByText("结果为空（0 字符）。", { exact: true }),
  ).toBeVisible();
  const output = page.locator(".output-panel");
  await expect(
    output.getByRole("button", { name: "复制", exact: true }),
  ).toBeEnabled();
  await expect(
    output.getByRole("button", { name: "下载", exact: true }),
  ).toBeEnabled();
  await expect(
    output.getByRole("button", { name: "发送到代码画布", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("输入", { exact: true }).fill("new input");
  await expect(
    output.getByRole("button", { name: "复制", exact: true }),
  ).toBeDisabled();
  assert.deepEqual(errors, []);
  console.log(
    "Canvas workbench: scale recovery, SVG, PNG, keyboard tabs, CRLF find, mobile layout and empty-result state passed.",
  );
} finally {
  await browser.close();
}
