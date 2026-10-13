import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const base = process.env.TEST_URL || "http://localhost:4173";
const browser = await chromium.launch({
  ...(process.env.PW_CHANNEL === "bundled" ? {} : { channel: "chrome" }),
});
const page = await browser.newPage({ locale: "zh-CN" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const requests = [];
page.on("request", (request) => requests.push(request.url()));
try {
  await page.goto(base + "/tools");
  await page.getByLabel("搜索工具", { exact: true }).fill("json");
  await expect(page.locator(".tool-card")).toHaveCount(2);
  assert.ok(
    !requests.some((url) =>
      /\/assets\/(CodeImage|TextToolPage|DiffTool|editor-runtime)-/.test(url),
    ),
    "Home must not request unused tool routes or editor runtime",
  );
  let releaseRoute;
  const routeLoaded = new Promise((resolve) => {
    releaseRoute = resolve;
  });
  await page.route("**/assets/CodeImage-*.js", async (route) => {
    await routeLoaded;
    await route.continue();
  });
  await page.goto(base + "/tools/code-image", { waitUntil: "commit" });
  await page.waitForFunction(() => document.getElementById("root")?.inert);
  await expect(page.locator(".canvas-artwork")).toBeVisible();
  assert.equal(
    await page.locator("#root").evaluate((element) => element.dataset.hydrated),
    undefined,
  );
  releaseRoute();
  await expect(page.locator(".canvas-artwork")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "导出", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  await page.unroute("**/assets/CodeImage-*.js");
  await page.goto(base + "/tools/json");
  await page.getByRole("button", { name: "加载示例", exact: true }).click();
  await page.getByRole("button", { name: "格式化", exact: true }).click();
  await expect(page.locator("#tool-output")).toContainText('"name"');
  await page.goto(base + "/tools/diff");
  const left = page.locator("#diff-left");
  const right = page.locator("#diff-right");
  const result = page.getByRole("region", { name: "Diff 结果" });
  const copy = page.getByRole("button", { name: "复制统一 Diff", exact: true });
  await left.fill("a\nb\nc\n");
  await right.fill("a\nx\nc\n");
  await expect(result).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".diff-line.is-add code")).toHaveText("x");
  await expect(page.locator(".diff-line.is-remove code")).toHaveText("b");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await copy.click();
  assert.equal(
    (await page.evaluate(() => navigator.clipboard.readText())).replace(
      /\r\n/g,
      "\n",
    ),
    "--- a/text\n+++ b/text\n@@ -1,3 +1,3 @@\n a\n-b\n+x\n c\n",
  );

  await right.fill("a\nb\nc\n");
  await expect(result).toHaveAttribute("aria-busy", "false");
  await expect(copy).toBeDisabled();
  await right.fill("中".repeat(Math.ceil((5 * 1024 * 1024) / 3)));
  await expect(page.getByRole("alert")).toContainText("5 MiB");
  await expect(page.locator(".diff-line")).toHaveCount(0);
  await expect(copy).toBeDisabled();

  // A controlled worker lets us exercise real debounce, input invalidation,
  // cancellation and timeout without depending on a slow machine.
  await page.route("**/assets/diff.worker-*.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `self.onmessage = ({data}) => {
      if (data.right === "stall") return;
      setTimeout(() => self.postMessage({requestId:data.requestId,status:"success",lines:[{kind:"add",text:data.right,right:1}]}), data.right === "old" ? 500 : 20);
    };`,
    }),
  );
  await page.reload();
  const workerResponse = page.waitForResponse("**/assets/diff.worker-*.js");
  await right.fill("old");
  await expect(result).toHaveAttribute("aria-busy", "true");
  await workerResponse;
  await right.fill("latest");
  await expect(page.locator(".diff-line code")).toHaveText("latest");
  // Returning to a previously completed input must still start a fresh request.
  await right.fill("other");
  await expect(page.locator(".diff-line code")).toHaveText("other");
  await right.fill("latest");
  await expect(result).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".diff-line")).toHaveCount(0);
  await expect(page.locator(".diff-line code")).toHaveText("latest");
  await right.fill("stall");
  await expect(page.locator(".diff-line")).toHaveCount(0);
  await expect(copy).toBeDisabled();
  await page.getByRole("button", { name: "取消处理", exact: true }).click();
  await expect(result).toHaveAttribute("aria-busy", "false");
  await expect(result).toContainText("比较已取消");
  await right.fill("fresh");
  await expect(page.locator(".diff-line code")).toHaveText("fresh");
  await right.fill("stall");
  await expect(page.getByRole("alert")).toContainText("8 秒", {
    timeout: 11000,
  });
  await expect(page.locator(".diff-line")).toHaveCount(0);
  await expect(copy).toBeDisabled();
  await right.fill("");
  await expect(result).toHaveAttribute("aria-busy", "false");
  await expect(page.getByRole("alert")).toHaveCount(0);
  assert.deepEqual(errors, []);
  const failedPage = await browser.newPage({ locale: "zh-CN" });
  await failedPage.route("**/assets/DiffTool-*.js", (route) =>
    route.abort("failed"),
  );
  await failedPage.goto(base + "/tools/diff");
  await expect(failedPage.getByRole("alert")).toContainText("页面加载失败");
  assert.equal(
    await failedPage.locator("#root").evaluate((element) => element.inert),
    false,
  );
  await failedPage.unroute("**/assets/DiffTool-*.js");
  await failedPage
    .getByRole("button", { name: "重新加载", exact: true })
    .click();
  await failedPage.waitForFunction(
    () => document.getElementById("root")?.dataset.hydrated === "true",
  );
  await expect(failedPage.getByRole("alert")).toHaveCount(0);
  await failedPage.close();
  console.log(
    "Diff checks passed: route isolation, delayed hydration, load-failure recovery, real Worker results, UTF-8 limit, unified patch, latest input, cancellation, timeout and stale-result invalidation.",
  );
} finally {
  await browser.close();
}
