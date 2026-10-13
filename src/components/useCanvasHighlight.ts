import { useEffect, useRef, useState } from "react";
import { type Segment } from "../utils/code-image";
import { CanvasHighlightClient } from "../utils/canvas-highlight";

export function useCanvasHighlight(code: string, language: string) {
  const [tokens, setTokens] = useState<{
    code: string;
    language: string;
    segments: Segment[];
  } | null>(null);
  const [issue, setIssue] = useState<{
    code: string;
    language: string;
    message: string;
  } | null>(null);
  const client = useRef<CanvasHighlightClient | null>(null);

  useEffect(() => {
    const active = new CanvasHighlightClient(
      () =>
        new Worker(new URL("../code-image.worker.ts", import.meta.url), {
          type: "module",
        }),
      (result) => {
        const { code, language } = result;
        if (result.error !== undefined)
          setIssue({ code, language, message: result.error });
        else {
          setIssue({ code, language, message: "" });
          setTokens({ code, language, segments: result.segments });
        }
      },
    );
    client.current = active;
    return () => {
      active.dispose();
      client.current = null;
    };
  }, []);

  useEffect(() => client.current?.request(code, language), [code, language]);

  const highlighted = tokens?.code === code && tokens.language === language;
  return {
    segments: highlighted ? tokens.segments : [{ text: code, type: "" }],
    highlighted,
    error:
      issue?.code === code && issue.language === language ? issue.message : "",
    tokens,
  };
}
