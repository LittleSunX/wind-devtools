import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CanvasHighlightClient,
  type HighlightRequest,
  type HighlightResponse,
  type HighlightWorker,
} from "../src/utils/canvas-highlight";

class TestWorker implements HighlightWorker {
  onmessage: Worker["onmessage"] = null;
  onerror: Worker["onerror"] = null;
  requests: HighlightRequest[] = [];
  terminate = vi.fn();
  postMessage(request: HighlightRequest) {
    this.requests.push(request);
  }
  respond(id: number, code = "highlighted") {
    this.onmessage?.call(
      this as unknown as Worker,
      new MessageEvent<HighlightResponse>("message", {
        data: { id, segments: [{ text: code, type: "keyword" }] },
      }),
    );
  }
  crash() {
    this.onerror?.call(this as unknown as Worker, {} as ErrorEvent);
  }
}

function fixture() {
  const workers: TestWorker[] = [];
  const onResult = vi.fn();
  const createWorker = vi.fn(() => {
    const worker = new TestWorker();
    workers.push(worker);
    return worker;
  });
  const client = new CanvasHighlightClient(createWorker, onResult);
  return { client, workers, createWorker, onResult };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("canvas highlight scheduling", () => {
  it("renders plain text locally without a Worker or debounce", () => {
    const { client, createWorker, onResult } = fixture();
    client.request("<plain> 中文", "plain");
    expect(createWorker).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith({
      id: 1,
      code: "<plain> 中文",
      language: "plain",
      segments: [{ text: "<plain> 中文", type: "" }],
    });
    vi.advanceTimersByTime(5000);
    expect(createWorker).not.toHaveBeenCalled();
    client.dispose();
  });

  it("debounces input and reuses a Worker across completed requests", () => {
    const { client, workers, createWorker, onResult } = fixture();
    client.request("first", "javascript");
    vi.advanceTimersByTime(60);
    client.request("second", "typescript");
    vi.advanceTimersByTime(119);
    expect(createWorker).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(workers[0].requests).toEqual([
      { id: 2, code: "second", language: "typescript" },
    ]);
    workers[0].respond(2, "second");
    client.request("third", "typescript");
    vi.advanceTimersByTime(120);
    workers[0].respond(3, "third");
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledTimes(2);
    client.dispose();
  });

  it("retains only the latest pending input and discards stale replies", () => {
    const { client, workers, onResult } = fixture();
    client.request("active", "javascript");
    vi.advanceTimersByTime(120);
    client.request("obsolete pending", "python");
    vi.advanceTimersByTime(120);
    client.request("latest", "tsx");
    vi.advanceTimersByTime(120);
    expect(workers[0].requests).toHaveLength(1);
    workers[0].respond(1);
    expect(onResult).not.toHaveBeenCalled();
    expect(workers[0].requests).toEqual([
      { id: 1, code: "active", language: "javascript" },
      { id: 3, code: "latest", language: "tsx" },
    ]);
    // A duplicate old reply must not consume the active request or its timer.
    workers[0].respond(1);
    expect(onResult).not.toHaveBeenCalled();
    workers[0].respond(3, "latest");
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0].code).toBe("latest");
    client.dispose();
  });

  it("keeps the debounce when obsolete work finishes during rapid typing", () => {
    const { client, workers } = fixture();
    client.request("active", "javascript");
    vi.advanceTimersByTime(120);
    client.request("pending", "javascript");
    vi.advanceTimersByTime(60);
    workers[0].respond(1);
    expect(workers[0].requests).toHaveLength(1);
    vi.advanceTimersByTime(60);
    expect(workers[0].requests[1].code).toBe("pending");
    client.dispose();
  });

  it("restarts a timed-out Worker with the latest pending request", () => {
    const { client, workers, onResult } = fixture();
    client.request("stalled", "javascript");
    vi.advanceTimersByTime(120);
    client.request("latest", "typescript");
    vi.advanceTimersByTime(3000);
    expect(workers).toHaveLength(2);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(workers[1].requests).toEqual([
      { id: 2, code: "latest", language: "typescript" },
    ]);
    expect(onResult).not.toHaveBeenCalled();
    workers[1].respond(2, "latest");
    expect(onResult.mock.calls[0][0].code).toBe("latest");
    client.dispose();
  });

  it("reports a current timeout and recovers on the next edit", () => {
    const { client, workers, onResult } = fixture();
    client.request("stalled", "javascript");
    vi.advanceTimersByTime(3120);
    expect(onResult.mock.calls[0][0].error).toContain("3 秒");
    client.request("retry", "javascript");
    vi.advanceTimersByTime(120);
    workers[1].respond(2, "retry");
    expect(onResult.mock.calls[1][0].segments[0].text).toBe("retry");
    client.dispose();
  });

  it("recovers from Worker startup failure and runtime errors", () => {
    const { client, workers, createWorker, onResult } = fixture();
    createWorker.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    client.request("first", "javascript");
    vi.advanceTimersByTime(120);
    expect(onResult.mock.calls[0][0].error).toContain("无法启动");
    client.request("second", "javascript");
    vi.advanceTimersByTime(120);
    workers[0].crash();
    expect(onResult.mock.calls[1][0].error).toContain("语法高亮失败");
    client.request("third", "javascript");
    vi.advanceTimersByTime(120);
    workers[1].respond(3, "third");
    expect(onResult.mock.calls[2][0].code).toBe("third");
    client.dispose();
  });

  it("restarts after a grammar loading failure instead of caching a bad module", () => {
    const { client, workers, onResult } = fixture();
    client.request("first", "typescript");
    vi.advanceTimersByTime(120);
    workers[0].onmessage?.call(
      workers[0] as unknown as Worker,
      new MessageEvent("message", {
        data: { id: 1, error: "grammar failed" },
      }),
    );
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0][0].error).toBe("grammar failed");
    client.request("retry", "typescript");
    vi.advanceTimersByTime(120);
    workers[1].respond(2, "retry");
    expect(onResult.mock.calls[1][0].code).toBe("retry");
    client.dispose();
  });

  it("cancels syntax work immediately when switching to plain text", () => {
    const { client, workers, onResult } = fixture();
    client.request("active", "javascript");
    vi.advanceTimersByTime(120);
    const staleReply = workers[0].onmessage;
    client.request("plain", "plain");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(onResult.mock.calls[0][0].segments).toEqual([
      { text: "plain", type: "" },
    ]);
    staleReply?.call(
      workers[0] as unknown as Worker,
      new MessageEvent("message", {
        data: { id: 1, segments: [{ text: "stale", type: "" }] },
      }),
    );
    vi.advanceTimersByTime(5000);
    expect(onResult).toHaveBeenCalledOnce();
    client.dispose();
  });

  it("cancels invalid input and all work on disposal", () => {
    const { client, workers, createWorker, onResult } = fixture();
    client.request("active", "javascript");
    vi.advanceTimersByTime(120);
    client.request("x".repeat(12001), "javascript");
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    client.request("pending", "javascript");
    client.dispose();
    client.request("after disposal", "plain");
    vi.advanceTimersByTime(5000);
    expect(createWorker).toHaveBeenCalledOnce();
    expect(onResult).not.toHaveBeenCalled();
  });
});
