import { chromium, firefox, webkit, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.TEST_URL || "http://localhost:4173";
await mkdir("artifacts", { recursive: true });
for (const [name, engine] of [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  const page = await browser.newPage({
    locale: "zh-CN",
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const hydrated = () =>
    expect(page.locator("#root")).toHaveAttribute("data-hydrated", "true", {
      timeout: 15000,
    });
  const reload = async () => {
    await page.reload();
    await hydrated();
  };
  try {
    await page.goto(base + "/tools/code-image");
    await hydrated();
    const download = page.getByRole("button", {
      name: "导出",
      exact: true,
    });
    await expect(download).toBeEnabled();
    const editor = page.getByLabel("代码", { exact: true });
    const source = await editor.inputValue();
    const canvas = await page
      .locator(".canvas-artwork")
      .evaluate((c) => c.innerHTML);
    const expanded = await page.locator("main").boundingBox();
    await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
    await expect(page.locator("#desktop-sidebar")).toHaveCSS("width", "64px");
    const collapsed = await page.locator("main").boundingBox();
    assert.ok(collapsed.width - expanded.width >= 160);
    assert.equal(await editor.inputValue(), source);
    assert.equal(
      await page.locator(".canvas-artwork").evaluate((c) => c.innerHTML),
      canvas,
    );
    await expect(download).toBeEnabled();
    await expect(
      page
        .locator("#desktop-sidebar")
        .getByRole("link", { name: "代码画布", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: `artifacts/sidebar-${name}-collapsed.png` });
    await reload();
    await expect(
      page.getByRole("button", { name: "展开侧边栏", exact: true }),
    ).toBeVisible();
    await page
      .locator("#desktop-sidebar")
      .getByRole("link", { name: "JSON 格式化", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "JSON 格式化", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "展开侧边栏", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "展开侧边栏", exact: true }).click();
    await expect(page.locator("#desktop-sidebar")).toHaveCSS("width", "232px");
    await page.setViewportSize({ width: 390, height: 844 });
    const open = page.getByRole("button", {
      name: "打开工具导航",
      exact: true,
    });
    const drawer = page.getByRole("dialog", {
      name: "工具导航菜单",
      exact: true,
    });
    await open.click();
    await expect(drawer).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.screenshot({ path: `artifacts/sidebar-${name}-mobile.png` });
    // Native modal navigation keeps keyboard focus away from obscured editors.
    await page.keyboard.press("Shift+Tab");
    assert.ok(
      await drawer.evaluate((el) => el.contains(document.activeElement)),
    );
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(open).toBeFocused();
    await open.click();
    await page.mouse.click(375, 400);
    await expect(drawer).not.toBeVisible();
    await open.click();
    await drawer.getByRole("link", { name: "代码画布", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "代码画布", exact: true }),
    ).toBeVisible();
    await expect(drawer).not.toBeVisible();
    await open.click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(drawer).not.toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    await expect(
      page.getByRole("button", { name: "收起侧边栏", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 320, height: 720 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    // Advance only the idle clock; exercise hover, focus, pinning and preference isolation.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.clock.install();
    await page.mouse.move(900, 200);
    await reload();
    const collapseButton = page.getByRole("button", {
      name: "收起侧边栏",
      exact: true,
    });
    await expect(collapseButton).toBeVisible();
    await page.clock.runFor(29000);
    await expect(collapseButton).toBeVisible();
    await page.clock.runFor(1500);
    await expect(
      page.getByRole("button", { name: "展开侧边栏", exact: true }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("wind.sidebar.collapsed")),
      "false",
    );
    await reload();
    await expect(collapseButton).toBeVisible();
    await page.locator("#desktop-sidebar").hover();
    await page.clock.runFor(31000);
    await expect(collapseButton).toBeVisible();
    await page.mouse.move(900, 200);
    const navLink = page
      .locator("#desktop-sidebar")
      .getByRole("link", { name: "代码画布", exact: true });
    await navLink.focus();
    await page.clock.runFor(31000);
    await expect(collapseButton).toBeVisible();
    await page.getByLabel("代码", { exact: true }).focus();
    await page.clock.runFor(31000);
    await expect(
      page.getByRole("button", { name: "展开侧边栏", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "展开侧边栏", exact: true }).click();
    await page.getByRole("button", { name: "固定展开", exact: true }).click();
    await page.mouse.move(900, 200);
    await page.getByLabel("代码", { exact: true }).focus();
    await page.clock.runFor(60000);
    await expect(collapseButton).toBeVisible();
    await reload();
    await expect(
      page.getByRole("button", { name: "已固定展开", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "已固定展开", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await open.click();
    await page.clock.runFor(60000);
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await page.clock.resume();
    await page.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked storage");
        },
      }),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await reload();
    await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "展开侧边栏", exact: true }),
    ).toBeVisible();
    assert.deepEqual(errors, []);
    console.log(
      `${name}: sidebar width, input preservation, persistence, mobile focus, dismissal and storage fallback passed.`,
    );
  } catch (error) {
    await page
      .screenshot({ path: `artifacts/sidebar-${name}-failure.png` })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}
