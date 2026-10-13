import { useEffect, useRef, useState } from "react";
import { i18n, type Message } from "../i18n";
import { trackTool } from "../analytics";
import {
  checkInput,
  createToolRequest,
  type AppOptions,
  type JsonOptions,
  type ProcessableToolId,
  type ToolResponse,
} from "../utils/shared";

export function useToolExecution() {
  const [output, setOutput] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const [error, setError] = useState<Message>("");
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function stop() {
    worker.current?.terminate();
    worker.current = null;
    clearTimeout(timer.current);
    setBusy(false);
  }

  function clear() {
    stop();
    setOutput("");
    setHasResult(false);
    setError("");
  }

  useEffect(
    () => () => {
      worker.current?.terminate();
      clearTimeout(timer.current);
    },
    [],
  );

  function run(
    id: ProcessableToolId,
    input: string,
    options: AppOptions,
    action: JsonOptions["action"] = "format",
  ) {
    clear();
    try {
      checkInput(input, id);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "处理失败，请检查输入。",
      );
      return;
    }
    setBusy(true);
    try {
      const active = new Worker(new URL("../worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = active;
      active.onmessage = (event: MessageEvent<ToolResponse>) => {
        if (worker.current !== active) return;
        const response = event.data;
        trackTool(
          id,
          action,
          response.status === "error" ? "error" : "success",
          response.status === "error" ? "invalid_input" : undefined,
        );
        setOutput(response.status === "success" ? response.result : "");
        setHasResult(response.status === "success");
        setError(response.status === "error" ? response.error : "");
        stop();
      };
      active.onerror = () => {
        if (worker.current !== active) return;
        trackTool(id, action, "error", "worker_error");
        setError("处理线程出现错误，请重试。");
        stop();
      };
      active.postMessage(
        createToolRequest(id, input, options, action, i18n.resolvedLanguage),
      );
      timer.current = setTimeout(() => {
        if (worker.current !== active) return;
        stop();
        trackTool(id, action, "error", "timeout");
        setError("处理超过 8 秒，已停止。请缩小输入或简化表达式。");
      }, 8000);
    } catch {
      stop();
      setError("无法启动处理线程，请检查浏览器设置后重试。");
    }
  }

  return { output, hasResult, error, busy, stop, clear, run };
}
