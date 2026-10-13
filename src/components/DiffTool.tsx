import { tr, useLocale } from "../i18n/react";
import { localizedPath } from "../i18n/routing";
import { useState } from "react";
import { formatUnifiedDiff } from "../utils/diff";
import { useDiffExecution } from "./useDiffExecution";
import { trackTool } from "../analytics";
import ToolIcon from "./ToolIcon";

const leftExample = `function greet(name) {
  return "Hello " + name;
}

console.log(greet("Wind"));`;

const rightExample = `function greet(name) {
  const message = \`Hello, \${name}!\`;
  return message;
}

console.log(greet("Wind"));`;

export default function DiffTool() {
  const locale = useLocale();
  const toolboxHref = localizedPath("/tools", locale === "en" ? "en" : "zh");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [notice, setNotice] = useState("");

  const { lines, error, busy, cancelled, stop } = useDiffExecution(left, right);

  const added = lines.filter((line) => line.kind === "add").length;
  const removed = lines.filter((line) => line.kind === "remove").length;

  async function copyDiff() {
    try {
      await navigator.clipboard.writeText(formatUnifiedDiff(lines));
      setNotice("差异结果已复制。");
      trackTool("diff", "copy", "success");
    } catch {
      setNotice("复制失败，请手动选择结果。");
    }
  }

  function loadExample() {
    setLeft(leftExample);
    setRight(rightExample);
    setNotice("");
  }

  return (
    <>
      <div className="breadcrumb">
        <a href={toolboxHref}>{tr("工具箱")}</a>
        <span>/</span>
        {tr("文本 Diff")}
      </div>
      <section className="tool-heading">
        <div>
          <div className="eyebrow">{tr("文本处理 / DIFF")}</div>
          <h1>{tr("文本 Diff")}</h1>
          <p>{tr("并排比较两段文本，快速定位新增、删除和未变化的行。")}</p>
          <div className="privacy-banner">
            <span aria-hidden="true">✓</span>
            {tr("比较只在当前浏览器完成，不上传文本内容。")}
          </div>
        </div>
        <ToolIcon id="diff" />
      </section>

      <div className="diff-inputs">
        <section className="editor-panel">
          <div className="editor-header">
            <label htmlFor="diff-left">
              {tr("原始文本")} <span>BEFORE</span>
            </label>
            <button {...{ autoComplete: "off" }} onClick={loadExample}>
              {tr("加载示例")}
            </button>
            <button
              {...{ autoComplete: "off" }}
              onClick={() => {
                setLeft("");
                setRight("");
                setNotice("");
              }}
            >
              {tr("清空")}
            </button>
          </div>
          <textarea
            autoComplete="off"
            id="diff-left"
            spellCheck={false}
            value={left}
            onChange={(event) => {
              setLeft(event.target.value);
              setNotice("");
            }}
            placeholder={tr("粘贴原始文本…")}
          />
          <div className="editor-footer">
            <span>{tr("{{count}} 字符", { count: left.length })}</span>
            <span>
              {tr("{{count}} 行", {
                count: left ? left.split(/\r\n|\r|\n/).length : 0,
              })}
            </span>
          </div>
        </section>
        <section className="editor-panel">
          <div className="editor-header">
            <label htmlFor="diff-right">
              {tr("修改后文本")} <span>AFTER</span>
            </label>
          </div>
          <textarea
            autoComplete="off"
            id="diff-right"
            spellCheck={false}
            value={right}
            onChange={(event) => {
              setRight(event.target.value);
              setNotice("");
            }}
            placeholder={tr("粘贴修改后的文本…")}
          />
          <div className="editor-footer">
            <span>{tr("{{count}} 字符", { count: right.length })}</span>
            <span>
              {tr("{{count}} 行", {
                count: right ? right.split(/\r\n|\r|\n/).length : 0,
              })}
            </span>
          </div>
        </section>
      </div>

      {error && (
        <div className="error-box" role="alert">
          {tr(error)}
        </div>
      )}

      <section
        className="diff-result"
        aria-label={tr("Diff 结果")}
        aria-busy={busy}
      >
        <div className="diff-result-header">
          <strong>{tr("差异结果")}</strong>
          <span>
            {lines.length
              ? tr("新增 {{added}} 行 · 删除 {{removed}} 行", {
                  added,
                  removed,
                })
              : tr("绿色新增 · 红色删除")}
          </span>
          {busy && (
            <button {...{ autoComplete: "off" }} onClick={stop}>
              {tr("取消处理")}
            </button>
          )}
          <button
            {...{ autoComplete: "off" }}
            disabled={!added && !removed}
            onClick={copyDiff}
          >
            {tr("复制统一 Diff")}
          </button>
        </div>
        {busy || cancelled || (!lines.length && !error) ? (
          <div className="diff-empty">
            {tr(
              busy
                ? "正在比较…"
                : cancelled
                  ? "比较已取消，修改文本后会重新比较。"
                  : "输入两侧文本后，这里会实时显示行级差异。",
            )}
          </div>
        ) : (
          <div className="diff-lines">
            {lines.map((line, index) => (
              <div className={`diff-line is-${line.kind}`} key={index}>
                <span className="diff-sign">
                  {line.kind === "add"
                    ? "+"
                    : line.kind === "remove"
                      ? "−"
                      : " "}
                </span>
                <span className="diff-number">{line.left ?? ""}</span>
                <span className="diff-number">{line.right ?? ""}</span>
                <code>{line.text || " "}</code>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="notice" role="status">
        {tr(notice)}
      </div>
      <section className="instructions">
        <h2>{tr("使用说明")}</h2>
        <p>
          {tr(
            "按行比较文本，适合代码、配置、SQL、日志和普通文本。单侧最多 1,200 行，两侧合计最多 5 MiB；比较在后台运行，可随时取消。复制结果包含文件头和差异块，可作为统一 Diff 补丁使用。",
          )}
        </p>
      </section>
    </>
  );
}
