import type { HighlightRequest } from "./utils/canvas-highlight";
(globalThis as unknown as { Prism: object }).Prism = {
  disableWorkerMessageHandler: true,
  manual: true,
};
self.onmessage = async (event: MessageEvent<HighlightRequest>) => {
  try {
    const { highlightCode } = await import("./utils/code-highlight");
    const segments = await highlightCode(event.data.code, event.data.language);
    self.postMessage({ id: event.data.id, segments });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error instanceof Error ? error.message : "语法高亮失败。",
    });
  }
};
