import { diffLines, type DiffRequest, type DiffResponse } from "./utils/diff";

self.onmessage = (event: MessageEvent<DiffRequest>) => {
  const { requestId, left, right } = event.data;
  try {
    self.postMessage({
      requestId,
      status: "success",
      lines: diffLines(left, right),
    } satisfies DiffResponse);
  } catch (error) {
    self.postMessage({
      requestId,
      status: "error",
      error: error instanceof Error ? error.message : "比较失败。",
    } satisfies DiffResponse);
  }
};
