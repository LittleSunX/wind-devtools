import { tr, useLocale } from "../i18n/react";
import { useEffect, useRef, useState } from "react";
import type { createEditor, EditorOptions } from "./editor-runtime";
import "./code-editor.css";

export default function CodeEditor(rawProps: EditorOptions) {
  const locale = useLocale();
  const props = {
    ...rawProps,
    locale,
    label: tr(rawProps.label),
    placeholder: tr(rawProps.placeholder),
  };
  const host = useRef<HTMLDivElement>(null);
  const fallback = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(props);
  const editor = useRef<ReturnType<typeof createEditor> | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    import("./editor-runtime")
      .then(({ createEditor }) => {
        if (disposed || !host.current) return;
        const field = fallback.current;
        const focused = document.activeElement === field;
        const start = field?.selectionStart || 0;
        const end = field?.selectionEnd || 0;
        editor.current = createEditor(host.current, latest.current);
        setReady(true);
        if (focused) editor.current.focus(start, end);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      editor.current?.destroy();
      editor.current = null;
    };
  }, []);
  useEffect(() => {
    latest.current = props;
    editor.current?.update(props);
  });
  return (
    <div className="code-editor">
      {!ready && (
        <textarea
          ref={fallback}
          id={props.id}
          aria-label={props.label}
          aria-invalid={props.invalid || undefined}
          aria-describedby={props.invalid ? "tool-error" : undefined}
          value={props.value}
          onChange={(e) => props.onChange?.(e.target.value)}
          readOnly={props.readOnly}
          spellCheck={false}
          placeholder={props.placeholder}
        />
      )}
      <div className="code-editor-host" ref={host} />
      {(props.value.length > 200_000 || failed) && (
        <div className="editor-mode">
          {tr(
            failed
              ? "基础编辑模式 · 刷新页面可重试加载高亮"
              : "大文本模式 · 已暂停语法高亮",
          )}
        </div>
      )}
    </div>
  );
}
