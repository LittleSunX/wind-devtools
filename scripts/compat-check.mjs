import { chromium, firefox, webkit, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { checkPreviewRecovery } from "./canvas-preview-checks.mjs";
import { mkdir } from "node:fs/promises";
import {
  canvasTools,
  captureArtwork,
  comparePixels,
} from "./canvas-test-utils.mjs";
await mkdir("artifacts", { recursive: true });
const base = process.env.TEST_URL || "http://localhost:4173";
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  const page = await browser.newPage({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1200 },
  });
  page.setDefaultTimeout(15000);
  const {
    download,
    editor,
    artwork,
    close,
    field,
    ready,
    openPopover,
    scale,
    png,
  } = canvasTools(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(base + "/tools/code-image");
    await ready();
    await (await field("画布缩放")).selectOption("1");
    await scale(1);
    await (await field("字体")).selectOption("source");
    await (await field("行高")).selectOption("1.4");
    await close();
    await editor.fill('const value = "中文 👨‍👩‍👧‍👦";\n\tconsole.log(value);\n');
    await ready();
    await page
      .locator(".canvas-frame")
      .evaluate((e) => (e.style.marginLeft = "0"));
    await editor.evaluate((e) => e.blur());
    const shot = await captureArtwork(
      page,
      artwork,
      `artifacts/${name}-artwork.png`,
    );
    const exported = await png(`artifacts/${name}-export.png`);
    const match = await comparePixels(page, shot, exported.bytes);
    assert.ok(
      match.sameSize && match.ratio < 0.05,
      `${name}: ${JSON.stringify(match)}`,
    );
    const copyPanel = await openPopover(
      page.getByRole("button", { name: "复制", exact: true }),
    );
    const popupEvent = page.waitForEvent("popup");
    await copyPanel.getByRole("button", { name: "在新标签页打开" }).click();
    const preview = await popupEvent;
    await expect(preview.locator("img")).toBeVisible();
    assert.equal(
      await preview.locator("img").evaluate((image) => image.naturalWidth),
      await artwork.evaluate((element) => element.offsetWidth),
    );
    await preview.close();
    await ready();
    await editor.focus();
    await editor.press("ControlOrMeta+End");
    await editor.pressSequentially("nativeInput");
    await expect(editor).toHaveValue(/nativeInput$/);
    await editor.press("ControlOrMeta+z");
    await expect(editor).not.toHaveValue(/nativeInput$/);
    await editor.press("ControlOrMeta+End");
    await editor.press("Tab");
    await expect(editor).toHaveValue(/    $/);
    // Coordinate-based editing must follow the visible text after zooming.
    await editor.fill("abcdefghij\nsecond line");
    await ready();
    await (await field("画布缩放")).selectOption("0.5");
    const hit = await editor.evaluate((el) => {
      const style = getComputedStyle(el);
      const context = document.createElement("canvas").getContext("2d");
      context.font = `${style.fontSize} ${style.fontFamily}`;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x + context.measureText("abcde").width * 0.5 + 0.1,
        y: rect.y + parseFloat(style.lineHeight) * 0.25,
      };
    });
    await page.mouse.click(hit.x, hit.y);
    assert.equal(await editor.evaluate((el) => el.selectionStart), 5);
    await editor.pressSequentially("X");
    await expect(editor).toHaveValue("abcdeXfghij\nsecond line");
    await (await field("画布缩放")).selectOption("1");
    await (await field("宽度模式")).selectOption("fixed");
    await (await field("画布宽度")).selectOption("640");
    await close();
    await editor.fill(
      'const mixed = "' + "中文 emoji 👨‍👩‍👧‍👦 identifier ".repeat(8) + '";',
    );
    await ready();
    const wrapped = await captureArtwork(page, artwork);
    const wrappedExport = await png(`artifacts/${name}-wrapped.png`);
    const wrappedMatch = await comparePixels(
      page,
      wrapped,
      wrappedExport.bytes,
    );
    assert.ok(
      wrappedMatch.sameSize && wrappedMatch.ratio < 0.05,
      `${name} wrapped: ${JSON.stringify(wrappedMatch)}`,
    );
    // Simulated composition verifies state handling; real OS IME still needs manual acceptance.
    await editor.dispatchEvent("compositionstart");
    await editor.fill("中文输入测试");
    await editor.dispatchEvent("compositionend", { data: "中文输入测试" });
    await ready();
    await expect(editor).toHaveValue("中文输入测试");
    await page.route("**/assets/code-image.worker-*.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: 'self.onmessage=e=>setTimeout(()=>self.postMessage({segments:[{text:e.data.code,type:""}]}),800)',
      }),
    );
    await editor.fill('const privateValue = "PRIVATE_SOURCE";');
    await expect(download).toBeDisabled();
    await expect(page.locator(".canvas-highlight")).toHaveText(
      /PRIVATE_SOURCE/,
    );
    await ready();
    await page.unroute("**/assets/code-image.worker-*.js");
    await (await field("窗口标题")).fill("PRIVATE_TITLE");
    await ready();
    await page.reload();
    await ready();
    assert.equal(await (await field("字体")).inputValue(), "source");
    assert.notEqual(
      await (await field("窗口标题")).inputValue(),
      "PRIVATE_TITLE",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await (await field("画布缩放")).selectOption("fit");
    await ready();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await editor.fill('const mobile = "touch";');
    await ready();
    await png(`artifacts/${name}-mobile.png`);
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      }),
    );
    const sharePanel = await openPopover(
      page.getByRole("button", { name: "复制", exact: true }),
    );
    await sharePanel
      .getByRole("button", { name: "复制图片", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "请使用「下载 PNG」" })
      .waitFor();
    await ready();
    assert.deepEqual(errors, []);
    await checkPreviewRecovery(browser, base);
    console.log(
      `${name}: visual/export/preview parity, native input/undo, composition events, delayed highlighting, preferences and mobile passed.`,
    );
  } catch (error) {
    await page
      .screenshot({ path: `artifacts/${name}-failure.png`, fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}
