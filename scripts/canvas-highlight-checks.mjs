import { expect } from "@playwright/test";
import assert from "node:assert/strict";
import { canvasTools } from "./canvas-test-utils.mjs";

export async function checkCanvasHighlightRecovery(page) {
  const { editor, ready, language } = canvasTools(page);
  const quickDownload = page.getByRole("button", {
    name: "快速下载 PNG",
    exact: true,
  });
  const highlighted = page.locator(".canvas-highlight");
  const workerPattern = "**/assets/code-image.worker-*.js";
  let workerLoads = 0;
  const routeWorker = (route) => {
    workerLoads++;
    return route.fulfill({
      contentType: "text/javascript",
      body: `
        self.__requests = [];
        const held = new Map();
        let holdInitial = ${workerLoads === 1};
        self.onmessage = ({ data }) => {
          if (data.release) {
            const request = held.get(data.release);
            if (request) {
              held.delete(data.release);
              self.postMessage({ id: request.id, mocked: true, segments: [{ text: request.code, type: "" }] });
            }
            return;
          }
          self.__requests.push(data);
          if (holdInitial) {
            holdInitial = false;
            held.set(data.id, data);
            return;
          }
          if (data.code.includes("CANVAS_STALL_61022")) return;
          if (/CANVAS_(ACTIVE|LATEST)_61022/.test(data.code)) {
            held.set(data.id, data);
            return;
          }
          setTimeout(() => self.postMessage({
            id: data.id,
            mocked: true,
            segments: [{ text: data.code, type: "" }],
          }), 800);
        };
      `,
    });
  };
  await page.addInitScript(() => {
    window.__canvasHighlightRequests = [];
    window.__canvasHighlightWorkers = [];
    window.__canvasHighlightReplies = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        const canvas = String(args[0]).includes("code-image.worker-");
        super(...args);
        if (!canvas) return;
        window.__canvasHighlightWorkers.push(this);
        this.addEventListener("message", ({ data }) => {
          window.__canvasHighlightReplies.push({
            id: data.id,
            mocked: data.mocked === true,
          });
        });
        const postMessage = this.postMessage.bind(this);
        this.postMessage = (message, ...options) => {
          if (typeof message.code === "string")
            window.__canvasHighlightRequests.push(message);
          return postMessage(message, ...options);
        };
      }
    };
  });
  await page.route(workerPattern, routeWorker);
  const requested = () =>
    page.evaluate(() =>
      window.__canvasHighlightRequests.map(({ code }) => code),
    );
  const release = (code) =>
    page.evaluate((code) => {
      const request = window.__canvasHighlightRequests.find(
        (request) => request.code === code,
      );
      window.__canvasHighlightWorkers[0].postMessage({ release: request.id });
    }, code);
  try {
    // A persistent Worker is unaffected by a newly installed route. Reload to
    // replace the real Worker, and reload again after unroute to restore it.
    await page.reload();
    await expect.poll(() => workerLoads).toBe(1);
    await expect.poll(async () => (await requested()).length).toBe(1);
    // Firefox must not restore the previous enabled state while the new
    // document is still waiting for its first highlight response.
    await expect(quickDownload).toBeDisabled();
    assert.deepEqual(
      await page.evaluate(() => window.__canvasHighlightReplies),
      [],
    );
    await release((await requested())[0]);
    await expect
      .poll(() =>
        page.evaluate(() => window.__canvasHighlightReplies[0]?.mocked),
      )
      .toBe(true);
    await ready();
    const active = 'const active = "CANVAS_ACTIVE_61022";';
    const obsolete = 'const obsolete = "CANVAS_PENDING_61022";';
    const latest = 'const latest = "CANVAS_LATEST_61022";';
    await editor.fill(active);
    await expect
      .poll(requested, { intervals: [10, 20, 40, 80] })
      .toContain(active);
    await editor.fill(obsolete);
    await expect(quickDownload).toBeDisabled();
    await editor.fill(latest);
    await expect(highlighted).toHaveText(/CANVAS_LATEST_61022/);
    await expect(quickDownload).toBeDisabled();
    // The active result is stale and must leave the latest source visible while
    // its replacement is still rendering. No intermediate task is queued.
    await release(active);
    await expect.poll(requested).toContain(latest);
    await expect(highlighted).toHaveText(/CANVAS_LATEST_61022/);
    await expect(quickDownload).toBeDisabled();
    await release(latest);
    await ready();
    assert.ok(!(await requested()).includes(obsolete));
    assert.equal(workerLoads, 1, "completed highlights must reuse one Worker");

    const stalled = 'const stalled = "CANVAS_STALL_61022";';
    await editor.fill(stalled);
    await expect.poll(requested).toContain(stalled);
    await editor.fill('const pendingRecovery = "CANVAS_RECOVERED_61022";');
    await ready();
    await expect(highlighted).toHaveText(/CANVAS_RECOVERED_61022/);
    assert.equal(
      workerLoads,
      2,
      "a stalled Worker must restart for pending input",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);

    await editor.fill('const currentTimeout = "CANVAS_STALL_61022";');
    await expect(page.getByRole("alert")).toHaveText(/高亮超过 3 秒/);
    await expect(quickDownload).toBeDisabled();
    await editor.fill('const retry = "CANVAS_RETRY_61022";');
    await ready();
    await expect(highlighted).toHaveText(/CANVAS_RETRY_61022/);
    assert.equal(
      workerLoads,
      3,
      "editing after a timeout must create a fresh Worker",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);

    await language("plain");
    await editor.fill("CANVAS_STALL_61022 plain text");
    await ready();
    await expect(highlighted).toHaveText(/CANVAS_STALL_61022 plain text/);
    assert.equal(workerLoads, 3, "plain text must not create a Worker");
  } finally {
    await page.unroute(workerPattern, routeWorker);
    await page.reload();
    await ready();
  }
}
