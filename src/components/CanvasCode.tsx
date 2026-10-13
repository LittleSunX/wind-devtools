import { tr, useLocale } from "../i18n/react";
import { useRef, useState, type CSSProperties } from "react";
import { splitSegments, type Segment } from "../utils/code-image";

/** The textarea handles native input/IME/undo; the full DOM below it is the artwork. */
export default function CanvasCode({
  code,
  segments,
  colors,
  muted,
  lineNumbers,
  startLine,
  highlightedLines,
  wrap,
  readOnly,
  onChange,
}: {
  code: string;
  segments: Segment[];
  colors: Record<string, string>;
  muted: string;
  lineNumbers: boolean;
  startLine: number;
  highlightedLines: Set<number>;
  wrap: boolean;
  readOnly: boolean;
  onChange: (code: string) => void;
}) {
  useLocale();
  const input = useRef<HTMLTextAreaElement>(null);
  const [find, setFind] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const escapeTab = useRef(false);
  // Preserve tabs: both layers use the same tab-size rather than changing source text.
  const lines = splitSegments(segments);
  const lastLineNumber = startLine + Math.max(0, lines.length - 1);
  const gutter = lineNumbers
    ? `${Math.max(2, String(lastLineNumber).length)}ch`
    : "0px";
  function search() {
    if (!query || !input.current) return;
    const start = input.current.selectionEnd;
    let index = code.indexOf(query, start);
    if (index < 0) index = code.indexOf(query);
    if (index < 0) {
      setMessage("没有找到匹配内容");
      return;
    }
    setMessage("");
    input.current.focus();
    input.current.setSelectionRange(index, index + query.length);
    const row = code.slice(0, index).split("\n").length - 1;
    const rows =
      input.current.parentElement?.querySelectorAll(".canvas-source-row");
    rows?.[row]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  return (
    <div
      className={`canvas-source ${wrap ? "is-wrapped" : ""}`}
      style={
        {
          "--code-gutter": gutter,
          "--code-gap": lineNumbers ? "24px" : "0px",
        } as CSSProperties
      }
    >
      <div className="canvas-highlight" aria-hidden="true">
        {lines.map((line, index) => (
          <div className="canvas-source-row" key={index}>
            <span
              className={`canvas-line-number ${highlightedLines.has(startLine + index) ? "is-highlighted" : ""}`}
              style={{ color: muted }}
            >
              {lineNumbers ? startLine + index : ""}
            </span>
            <span
              className={`canvas-source-line ${highlightedLines.has(startLine + index) ? "is-highlighted" : ""}`}
            >
              {line.length
                ? line.map((segment, i) => (
                    <span key={i} style={{ color: colors[segment.type] }}>
                      {segment.text}
                    </span>
                  ))
                : "\u200b"}
            </span>
          </div>
        ))}
      </div>
      <textarea
        autoComplete="off"
        ref={input}
        id="shot-code"
        className="canvas-input"
        data-export-ignore
        aria-label={tr("代码")}
        value={code}
        onChange={(event) =>
          onChange(event.target.value.replace(/\r\n?/g, "\n"))
        }
        readOnly={readOnly}
        wrap={wrap ? "soft" : "off"}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-describedby="canvas-help"
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "f"
          ) {
            event.preventDefault();
            setFind(true);
            return;
          }
          if (event.key === "Escape") {
            escapeTab.current = true;
            setFind(false);
            return;
          }
          if (
            event.key === "Tab" &&
            !event.shiftKey &&
            !escapeTab.current &&
            !readOnly
          ) {
            event.preventDefault();
            // Native editing command keeps this insertion in the browser's undo stack.
            document.execCommand("insertText", false, "    ");
          }
          escapeTab.current = false;
        }}
      />
      {!code && (
        <span className="canvas-placeholder" data-export-ignore>
          {tr("在这里输入或粘贴代码…")}
        </span>
      )}
      {find && (
        <div
          className="canvas-find"
          data-export-ignore
          role="search"
          aria-label={tr("查找代码")}
        >
          <input
            autoFocus
            aria-label={tr("查找内容")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") search();
              if (event.key === "Escape") {
                setFind(false);
                input.current?.focus();
              }
            }}
          />
          <button type="button" onClick={search}>
            {tr("下一个")}
          </button>
          <button
            type="button"
            aria-label={tr("关闭查找")}
            onClick={() => {
              setFind(false);
              input.current?.focus();
            }}
          >
            ×
          </button>
          {message && <span role="status">{tr(message)}</span>}
        </div>
      )}
    </div>
  );
}
