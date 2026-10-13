import { useEffect, useRef, useState } from "react";
import {
  MAX_DIFF_BYTES,
  type DiffLine,
  type DiffResponse,
} from "../utils/diff";

type Comparison = {
  requestId: number;
  left: string;
  right: string;
  lines: DiffLine[];
  error: string;
  status: "success" | "error" | "cancelled";
};

export function useDiffExecution(left: string, right: string) {
  const [request, setRequest] = useState({ left, right, requestId: 0 });
  if (request.left !== left || request.right !== right)
    setRequest({ left, right, requestId: request.requestId + 1 });
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const pending = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    const { left, right, requestId } = request;
    if (!left && !right) return;
    let active: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const cancel = () => {
      disposed = true;
      clearTimeout(debounce);
      clearTimeout(timeout);
      active?.terminate();
    };
    const finish = (result: Pick<Comparison, "lines" | "error" | "status">) => {
      if (disposed) return;
      setComparison({ requestId, left, right, ...result });
      cancel();
    };
    pending.current = {
      cancel: () => finish({ lines: [], error: "", status: "cancelled" }),
    };
    const debounce = setTimeout(() => {
      if (left.length + right.length > MAX_DIFF_BYTES) {
        finish({
          lines: [],
          error: "Diff 两侧文本合计最多支持 5 MiB，请拆分后比较。",
          status: "error",
        });
        return;
      }
      try {
        active = new Worker(new URL("../diff.worker.ts", import.meta.url), {
          type: "module",
        });
        active.onmessage = (event: MessageEvent<DiffResponse>) => {
          if (event.data.requestId !== requestId) return;
          finish(
            event.data.status === "success"
              ? { lines: event.data.lines, error: "", status: "success" }
              : { lines: [], error: event.data.error, status: "error" },
          );
        };
        active.onerror = () =>
          finish({
            lines: [],
            error: "处理线程出现错误，请重试。",
            status: "error",
          });
        active.postMessage({ requestId, left, right });
        timeout = setTimeout(
          () =>
            finish({
              lines: [],
              error: "比较超过 8 秒，已停止。请缩小文本后重试。",
              status: "error",
            }),
          8000,
        );
      } catch {
        finish({
          lines: [],
          error: "无法启动处理线程，请检查浏览器设置后重试。",
          status: "error",
        });
      }
    }, 150);
    return () => {
      cancel();
      pending.current = null;
    };
  }, [request]);

  // A changed input invalidates its previous rows in the same render, before
  // the next effect starts the debounced request.
  const current =
    comparison?.requestId === request.requestId &&
    comparison.left === left &&
    comparison.right === right
      ? comparison
      : null;
  return {
    lines: current?.lines ?? [],
    error: current?.error ?? "",
    busy: Boolean((left || right) && !current),
    cancelled: current?.status === "cancelled",
    stop: () => pending.current?.cancel(),
  };
}
