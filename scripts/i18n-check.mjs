import { chromium, firefox, webkit, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:4173";
await mkdir("artifacts", { recursive: true });
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 1120 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  // Exercise slower worker startup without relying on arbitrary page sleeps.
  const workerDelay = Number(process.env.I18N_WORKER_DELAY_MS || 0);
  if (workerDelay > 0) {
    await page.route("**/assets/code-image.worker-*.js", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, workerDelay));
      await route.continue();
    });
  }
  const errors = [];
  const failedRequests = [];
  page.on("requestfailed", (request) =>
    failedRequests.push({
      url: request.url(),
      page: page.url(),
      failure: request.failure(),
    }),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error")
      errors.push({
        message: m.text(),
        page: page.url(),
        location: m.location(),
      });
  });
  const canvasReady = async () => {
    // Language hydration can finish before fonts, measurement and worker highlighting.
    // Do not navigate away or replace code while the initial worker is still loading.
    await expect(
      page.getByRole("button", { name: "Export", exact: true }),
    ).toBeEnabled({ timeout: 15000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
  };
  const switchTo = async (language) => {
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    const before = await page.locator(".language-control").boundingBox();
    await page.locator(".language-trigger").click();
    await page
      .locator(".language-menu")
      .getByRole("menuitemradio", {
        name: language === "zh" ? "中文" : "English",
        exact: true,
      })
      .click();
    await expect(page.locator("html")).toHaveAttribute(
      "lang",
      language === "zh" ? "zh-CN" : "en",
    );
    await expect(page.locator(".language-trigger")).toHaveText(
      language === "zh" ? "中文" : "English",
    );
    await expect(page.locator(".language-trigger")).toBeFocused();
    await expect(page.locator(".language-trigger")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    assert.equal(await page.evaluate(() => performance.timeOrigin), timeOrigin);
    const after = await page.locator(".language-control").boundingBox();
    assert.equal(
      after.width,
      before.width,
      "Language control must not resize on switching",
    );
  };
  const noChineseUI = async () => {
    const leftovers = await page.evaluate(() => {
      const found = [],
        walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode,
          parent = node.parentElement;
        if (
          !parent ||
          parent.closest(
            "script, style, textarea, .cm-content, .canvas-artwork, .diff-lines, .language-control",
          )
        )
          continue;
        if (!parent.getClientRects().length) continue;
        if (/\p{Script=Han}/u.test(node.textContent))
          found.push(node.textContent.trim());
      }
      return found;
    });
    assert.deepEqual(
      leftovers,
      [],
      `Untranslated UI: ${leftovers.join(" | ")}`,
    );
  };
  try {
    await page.goto(base + "/");
    await expect(page).toHaveURL(/\/en\/tools$/);
    await page.goto(base + "/en/tools");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveURL(/\/en\/tools$/);
    const trigger = page.locator(".language-trigger");
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("menuitemradio", { name: "English", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.locator(".hero h1").click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await page.getByLabel("Search tools", { exact: true }).fill("timestamp");
    await expect(page.locator(".tool-card")).toHaveCount(1);
    await expect(page.locator(".filters > span")).toHaveText("1 tool");
    await switchTo("zh");
    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.getByLabel("搜索工具", { exact: true })).toHaveValue(
      "timestamp",
    );
    await page.reload();
    await expect(page.locator(".language-trigger")).toHaveText("中文");
    await switchTo("en");
    await expect(page).toHaveURL(/\/en\/tools$/);
    await page.getByRole("button", { name: "Data tools", exact: true }).click();
    const count = await page.locator(".tool-card").count();
    await switchTo("zh");
    await expect(page.locator(".tool-card")).toHaveCount(count);
    await switchTo("en");
    await page.goto(base + "/en/tools/json");
    await page.getByRole("button", { name: "Format", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "Enter some content first.",
    );
    await noChineseUI();

    for (const tool of [
      "json",
      "timestamp",
      "jwt",
      "sql",
      "cron",
      "diff",
      "codec",
      "json-type",
      "text",
      "code-image",
    ]) {
      await page.goto(`${base}/en/tools/${tool}`);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      if (tool === "code-image") await canvasReady();
      await noChineseUI();
    }
    const missing = await page.goto(base + "/en/missing");
    assert.equal(missing.status(), 404);
    await page.getByRole("heading", { name: /does not exist/i }).waitFor();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await noChineseUI();
    for (let index = errors.length - 1; index >= 0; index--) {
      const error = errors[index];
      if (
        typeof error === "object" &&
        (error.page?.endsWith("/en/missing") ||
          error.location?.url?.endsWith("/en/missing")) &&
        /404/.test(error.message)
      )
        errors.splice(index, 1);
    }

    // Worker-generated explanatory output uses the selected language too.
    for (const [tool, action, expected] of [
      ["timestamp", "Convert", "Timestamp (seconds)"],
      ["jwt", "Decode JWT", "Time information (based on the device clock)"],
      ["cron", "Calculate schedule", "Upcoming runs"],
    ]) {
      await page.goto(`${base}/en/tools/${tool}`);
      await page
        .getByRole("button", { name: "Load example", exact: true })
        .click();
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page.getByLabel("Result", { exact: true })).toHaveValue(
        new RegExp(expected.replace(/[()]/g, "\\$&")),
      );
    }
    await page.goto(base + "/en/tools/code-image");
    await canvasReady();
    const code = page.getByLabel("Code", { exact: true });
    await code.fill('const greeting = "中文 {{name}}";');
    await page.getByLabel("Window title", { exact: true }).fill("保留标题.ts");
    await page.getByLabel("Style", { exact: true }).selectOption("暖纸手记");
    await expect(
      page.getByRole("button", { name: "Export", exact: true }),
    ).toBeEnabled();
    await switchTo("zh");
    await expect(page.getByLabel("代码", { exact: true })).toHaveValue(
      'const greeting = "中文 {{name}}";',
    );
    await expect(page.getByLabel("窗口标题", { exact: true })).toHaveValue(
      "保留标题.ts",
    );
    await expect(page.getByLabel("风格", { exact: true })).toHaveValue(
      "暖纸手记",
    );
    await switchTo("en");
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Appearance", exact: true }),
    ).toBeVisible();
    await noChineseUI();
    await page.screenshot({ path: `artifacts/i18n-${name}-appearance.png` });
    await page
      .getByRole("button", { name: "Close Appearance", exact: true })
      .click();
    await page.goto(base + "/en/tools/codec");
    const input = page.getByLabel("Input", { exact: true });
    await input.fill("代码画布 {{name}}");
    await page.getByRole("button", { name: "Convert", exact: true }).click();
    await expect(page.getByLabel("Result", { exact: true })).not.toHaveValue(
      "",
    );
    const result = await page
      .getByLabel("Result", { exact: true })
      .inputValue();
    await switchTo("zh");
    await expect(page.getByLabel("输入", { exact: true })).toHaveValue(
      "代码画布 {{name}}",
    );
    await expect(page.getByLabel("处理结果", { exact: true })).toHaveValue(
      result,
    );
    await page.goto(base + "/tools/json");
    await expect(page.locator(".cm-content").first()).toBeVisible();
    await expect(page.locator(".code-editor textarea")).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "输入", exact: true })
      .fill('{"代码":1,"代码":2}');
    await page.getByRole("button", { name: "格式化", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("重复键");
    await switchTo("en");
    await expect(page.getByRole("alert")).toContainText("Duplicate key “代码”");
    await expect(
      page.getByRole("textbox", { name: "Input", exact: true }),
    ).toHaveText('{"代码":1,"代码":2}');
    await page
      .getByRole("textbox", { name: "Input", exact: true })
      .fill('{"中文":1}');
    await page.getByRole("button", { name: "Format", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Result", exact: true }),
    ).toContainText('"中文": 1');
    await page
      .getByRole("button", { name: "Send to canvas", exact: true })
      .click();
    await expect(page.getByLabel("Code", { exact: true })).toHaveValue(
      /"中文": 1/,
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page).toHaveURL(/\/en\/tools\/code-image$/);
    await canvasReady();
    await noChineseUI();
    for (const width of [320, 375, 390, 414, 800]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/en/tools",
        "/en/tools/json",
        "/en/tools/code-image",
      ]) {
        await page.goto(base + route);
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        if (route === "/en/tools/code-image") await canvasReady();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${route} overflows at ${width}`,
        );
        await expect(page.locator(".language-control")).toBeVisible();
      }
    }
    await page.screenshot({ path: `artifacts/i18n-${name}-mobile.png` });
    assert.deepEqual(errors, []);
    // Preference failures must not break detection or switching.
    const blocked = await browser.newContext({ locale: "en-US" });
    await blocked.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new Error("blocked");
      };
      Storage.prototype.setItem = () => {
        throw new Error("blocked");
      };
    });
    const other = await blocked.newPage();
    await other.goto(base + "/en/tools");
    await expect(other.locator("html")).toHaveAttribute("lang", "en");
    await other.locator(".language-trigger").click();
    await other
      .getByRole("menuitemradio", { name: "中文", exact: true })
      .click();
    await expect(other.locator("html")).toHaveAttribute("lang", "zh-CN");
    await blocked.close();
    console.log(
      `${name}: bilingual UI, persistence, state preservation, errors, transfer, mobile and blocked storage passed.`,
    );
  } catch (error) {
    await writeFile(
      `artifacts/i18n-${name}-errors.json`,
      JSON.stringify({ errors, failedRequests }, null, 2),
    );
    await page.screenshot({
      path: `artifacts/i18n-${name}-failure.png`,
      fullPage: true,
    });
    throw error;
  } finally {
    await browser.close();
  }
}
