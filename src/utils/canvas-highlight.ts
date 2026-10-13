import { validateCode, type Segment } from "./code-image";

export type HighlightRequest = {
  id: number;
  code: string;
  language: string;
};

export type HighlightResponse = { id: number } & (
  { segments: Segment[]; error?: never } | { error: string; segments?: never }
);

export type HighlightResult = HighlightRequest & HighlightResponse;

export type HighlightWorker = {
  postMessage(request: HighlightRequest): void;
  terminate(): void;
  onmessage: Worker["onmessage"];
  onerror: Worker["onerror"];
};

/** Keep one active task and one latest input, without queuing work in the Worker. */
export class CanvasHighlightClient {
  private worker: HighlightWorker | null = null;
  private active: HighlightRequest | null = null;
  private pending: HighlightRequest | null = null;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private latestId = 0;
  private disposed = false;

  constructor(
    private createWorker: () => HighlightWorker,
    private onResult: (result: HighlightResult) => void,
  ) {}

  request(code: string, language: string) {
    if (this.disposed) return;
    const request = { id: ++this.latestId, code, language };
    clearTimeout(this.debounce);
    this.debounce = undefined;
    this.pending = null;
    try {
      validateCode(code);
    } catch {
      // Invalid input and plain text must not wait for obsolete syntax work.
      if (this.active) this.stopWorker();
      return;
    }
    if (language === "plain") {
      if (this.active) this.stopWorker();
      this.onResult({ ...request, segments: [{ text: code, type: "" }] });
      return;
    }
    this.pending = request;
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      this.flush();
    }, 120);
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.debounce);
    this.debounce = undefined;
    this.pending = null;
    this.stopWorker();
  }

  private stopWorker() {
    clearTimeout(this.timeout);
    this.timeout = undefined;
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
    }
    this.worker = null;
    this.active = null;
  }

  private fail(request: HighlightRequest, message: string) {
    this.stopWorker();
    if (!this.disposed && request.id === this.latestId)
      this.onResult({ ...request, error: message });
    if (!this.debounce) this.flush();
  }

  private flush() {
    if (this.disposed || this.active || !this.pending) return;
    const request = this.pending;
    this.pending = null;
    try {
      if (!this.worker) {
        const worker = this.createWorker();
        this.worker = worker;
        worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
          const active = this.active;
          if (
            this.disposed ||
            this.worker !== worker ||
            !active ||
            event.data.id !== active.id
          )
            return;
          if (event.data.error !== undefined) {
            // A failed dynamic import can stay cached in the Worker. Restart it
            // so the next request can recover after a transient loading failure.
            this.fail(active, event.data.error);
            return;
          }
          clearTimeout(this.timeout);
          this.timeout = undefined;
          this.active = null;
          if (active.id === this.latestId)
            this.onResult({ ...active, ...event.data });
          if (!this.debounce) this.flush();
        };
        worker.onerror = () => {
          if (this.worker !== worker || !this.active) return;
          this.fail(this.active, "语法高亮失败，请尝试纯文本模式。");
        };
      }
      this.active = request;
      this.worker.postMessage(request);
      this.timeout = setTimeout(() => {
        if (this.active?.id !== request.id) return;
        this.fail(request, "高亮超过 3 秒，请精简代码或使用纯文本模式。");
      }, 3000);
    } catch {
      this.fail(request, "无法启动语法高亮，请检查浏览器设置。");
    }
  }
}
