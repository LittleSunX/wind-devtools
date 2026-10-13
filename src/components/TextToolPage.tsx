import { tr } from "../i18n/react";
import type { Language } from "../i18n";
import { localizedPath } from "../i18n/routing";
import CodeEditor from "./CodeEditor";
import ToolIcon from "./ToolIcon";
import { useEffect, useState } from "react";
import type { ToolDefinition } from "../catalog";
import { trackTool } from "../analytics";
import { downloadFilename } from "../utils/download-filename";
import { useToolExecution } from "./useToolExecution";
import {
  isProcessableToolId,
  type AppOptions,
  type JsonOptions,
} from "../utils/shared";
import {
  createCanvasTransfer,
  writeCanvasTransfer,
} from "../utils/canvas-transfer";

const defaultOptions: AppOptions = {
  indent: "2",
  dialect: "mysql",
  keyword: "upper",
  unit: "ms",
  zone: "UTC",
  direction: "timestamp",
  mode: "quartz",
  codec: "base64",
  codecDirection: "encode",
  textAction: "dedupe",
  target: "typescript",
  rootName: "Root",
  prefix: "",
  suffix: "",
};
function Select<Value extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: Value;
  items: ReadonlyArray<readonly [Value, string]>;
  onChange: (v: Value) => void;
}) {
  return (
    <label className="select-label">
      {tr(label)}
      <select
        aria-label={tr(label)}
        value={value}
        onChange={(e) => {
          const selected = items.find(([value]) => value === e.target.value);
          if (selected) onChange(selected[0]);
        }}
      >
        {items.map(([v, l]) => (
          <option key={v} value={v}>
            {tr(l)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function TextToolPage({
  current,
  language,
}: {
  current: ToolDefinition;
  language: Language;
}) {
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [replace, setReplace] = useState(false);
  const [wrap, setWrap] = useState(true);
  const codeLanguage =
    current?.id === "json" || current?.id === "sql" ? current.id : undefined;
  const [options, setOptions] = useState<AppOptions>(defaultOptions);
  const [now, setNow] = useState<number>();
  const {
    output,
    hasResult,
    error,
    busy,
    stop,
    clear,
    run: execute,
  } = useToolExecution();
  function invalidate() {
    clear();
    setNotice("");
  }
  function changeInput(value: string) {
    invalidate();
    setInput(value);
    setReplace(false);
  }
  function option<K extends keyof AppOptions>(key: K, value: AppOptions[K]) {
    invalidate();
    setOptions((o) => ({ ...o, [key]: value }));
  }
  useEffect(() => {
    if (current?.id !== "timestamp") return;
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [current?.id]);
  function example() {
    if (current?.id === "timestamp" && options.direction === "date")
      return "2026-09-14 00:00:00";
    if (current?.id === "timestamp" && options.unit === "s")
      return "1789344000";
    if (current?.id === "cron" && options.mode === "linux")
      return "*/5 * * * *";
    return current?.example || "";
  }
  function run(action: JsonOptions["action"] = "format") {
    if (!isProcessableToolId(current.id)) return;
    setNotice("");
    execute(current.id, input, options, action);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setNotice("已复制到剪贴板");
    } catch {
      setNotice("复制失败，请在结果区域手动选择并复制。");
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([output], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    const extension =
      current.id === "sql" ? "sql" : current.id === "json" ? "json" : "txt";
    a.download = downloadFilename(`wind-${current.id}`, extension);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function sendToCanvas() {
    if (!current || !output) return;
    if (output.length > 12000 || output.split(/\r\n|\r|\n/).length > 160) {
      setNotice(
        "结果超过代码画布限制（12,000 字符 / 160 行），请精简后再发送。",
      );
      return;
    }
    const transferOverride =
      current.id === "json-type"
        ? {
            language: options.target === "java" ? "java" : "typescript",
            title:
              options.target === "java"
                ? `${options.rootName || "Root"}.java`
                : `${options.rootName || "Root"}.ts`,
          }
        : undefined;
    const payload = createCanvasTransfer(current.id, output, transferOverride);
    if (!payload) {
      setNotice("当前结果暂不支持发送到代码画布。");
      return;
    }
    try {
      writeCanvasTransfer(sessionStorage, payload);
      trackTool(current.id, "send_to_canvas", "success");
      window.location.assign(localizedPath("/tools/code-image", language));
    } catch {
      trackTool(current.id, "send_to_canvas", "error");
      setNotice("无法暂存结果，请检查浏览器存储设置后重试。");
    }
  }
  return (
    <>
      <div className="breadcrumb">
        <a href={localizedPath("/tools", language)}>{tr("工具箱")}</a>
        <span>/</span>
        {tr(current.name)}
      </div>
      <section className="tool-heading">
        <div>
          <div className="eyebrow">
            {tr(current.category)} / {current.id.toUpperCase()}
          </div>
          <h1>{tr(current.name)}</h1>
          <p>{tr(current.description)}</p>
          <div className="privacy-banner">
            <span aria-hidden="true">✓</span>
            {tr("数据仅在当前浏览器处理，刷新后不会自动恢复。")}
          </div>
        </div>
        <ToolIcon id={current.id} />
      </section>
      {current.id === "timestamp" && (
        <div className="live-time">
          <span>
            <i /> {tr("当前时间戳")}
          </span>
          <strong>{now ?? "—"}</strong>
          <button
            {...{ autoComplete: "off" }}
            onClick={() => {
              option("direction", "timestamp");
              setOptions((o) => ({
                ...o,
                direction: "timestamp",
                unit: "ms",
              }));
              changeInput(String(Date.now()));
            }}
          >
            {tr("填入当前时间 ↙")}
          </button>
        </div>
      )}
      <div className="options-bar">
        {(current.id === "json" || current.id === "sql") && (
          <Select
            label="缩进"
            value={options.indent!}
            items={[
              ["2", "2 个空格"],
              ["4", "4 个空格"],
            ]}
            onChange={(v) => option("indent", v)}
          />
        )}
        {current.id === "sql" && (
          <>
            <Select
              label="SQL 方言"
              value={options.dialect!}
              items={[
                ["mysql", "MySQL"],
                ["postgresql", "PostgreSQL"],
                ["plsql", "Oracle / PL SQL"],
              ]}
              onChange={(v) => option("dialect", v)}
            />
            <Select
              label="关键字"
              value={options.keyword!}
              items={[
                ["upper", "大写"],
                ["lower", "小写"],
              ]}
              onChange={(v) => option("keyword", v)}
            />
          </>
        )}
        {current.id === "timestamp" && (
          <>
            <Select
              label="转换方向"
              value={options.direction!}
              items={[
                ["timestamp", "时间戳 → 日期"],
                ["date", "日期 → 时间戳"],
              ]}
              onChange={(v) => option("direction", v)}
            />
            <Select
              label="输入单位"
              value={options.unit!}
              items={[
                ["ms", "毫秒（ms）"],
                ["s", "秒（s）"],
              ]}
              onChange={(v) => option("unit", v)}
            />
          </>
        )}
        {current.id === "cron" && (
          <Select
            label="表达式模式"
            value={options.mode!}
            items={[
              ["quartz", "Quartz · 6 字段"],
              ["linux", "Linux · 5 字段"],
            ]}
            onChange={(v) => option("mode", v)}
          />
        )}
        {current.id === "codec" && (
          <>
            <Select
              label="编码类型"
              value={options.codec!}
              items={[
                ["base64", "Base64"],
                ["url", "URL 编码"],
              ]}
              onChange={(v) => option("codec", v)}
            />
            <Select
              label="操作"
              value={options.codecDirection!}
              items={[
                ["encode", "编码"],
                ["decode", "解码"],
              ]}
              onChange={(v) => option("codecDirection", v)}
            />
          </>
        )}
        {current.id === "json-type" && (
          <>
            <Select
              label="目标语言"
              value={options.target!}
              items={[
                ["typescript", "TypeScript"],
                ["java", "Java"],
              ]}
              onChange={(v) => option("target", v)}
            />
            <label className="select-label">
              {tr("根类型名")}
              <input
                aria-label={tr("根类型名")}
                value={options.rootName || ""}
                maxLength={40}
                onChange={(event) => option("rootName", event.target.value)}
              />
            </label>
          </>
        )}
        {current.id === "text" && (
          <>
            <Select
              label="处理方式"
              value={options.textAction!}
              items={[
                ["dedupe", "按行去重"],
                ["sort-asc", "升序排序"],
                ["sort-desc", "降序排序"],
                ["trim-lines", "每行 Trim"],
                ["remove-empty", "删除空行"],
                ["upper", "转大写"],
                ["lower", "转小写"],
                ["prefix", "添加前缀"],
                ["suffix", "添加后缀"],
              ]}
              onChange={(v) => option("textAction", v)}
            />
            {options.textAction === "prefix" && (
              <label className="select-label">
                {tr("前缀")}
                <input
                  aria-label={tr("前缀")}
                  value={options.prefix || ""}
                  onChange={(event) => option("prefix", event.target.value)}
                />
              </label>
            )}
            {options.textAction === "suffix" && (
              <label className="select-label">
                {tr("后缀")}
                <input
                  aria-label={tr("后缀")}
                  value={options.suffix || ""}
                  onChange={(event) => option("suffix", event.target.value)}
                />
              </label>
            )}
          </>
        )}
        {(current.id === "timestamp" || current.id === "cron") && (
          <Select
            label="时区"
            value={options.zone!}
            items={[
              ["UTC", "UTC"],
              ["local", "浏览器本地时区"],
            ]}
            onChange={(v) => option("zone", v)}
          />
        )}
        {codeLanguage && (
          <label className="wrap-option">
            <input
              type="checkbox"
              checked={wrap}
              onChange={(e) => setWrap(e.target.checked)}
            />
            {tr("自动换行")}
          </label>
        )}
        <span className="option-hint">
          {tr(
            current.id === "jwt"
              ? "仅解码 · 不验证签名"
              : "⌘ / Ctrl + Enter 执行",
          )}
        </span>
      </div>
      {current.id === "cron" && (
        <div className="presets">
          {[
            ["每分钟", "* * * * *", "0 * * * * ?"],
            ["每 5 分钟", "*/5 * * * *", "0 */5 * * * ?"],
            ["每小时", "0 * * * *", "0 0 * * * ?"],
            ["每天凌晨", "0 0 * * *", "0 0 0 * * ?"],
            ["每周一", "0 0 * * 1", "0 0 0 ? * 2"],
            ["每月 1 日", "0 0 1 * *", "0 0 0 1 * ?"],
          ].map(([label, linux, quartz]) => (
            <button
              {...{ autoComplete: "off" }}
              key={label}
              onClick={() =>
                changeInput(options.mode === "linux" ? linux : quartz)
              }
            >
              {tr(label)}
            </button>
          ))}
        </div>
      )}
      <div
        className="editors"
        onKeyDownCapture={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            run();
          }
        }}
      >
        <section className="editor-panel">
          <div className="editor-header">
            <label htmlFor="tool-input">
              {tr("输入")} <span>INPUT</span>
            </label>
            <button
              {...{ autoComplete: "off" }}
              onClick={() =>
                input ? setReplace(true) : changeInput(example())
              }
            >
              {tr("加载示例")}
            </button>
            <button
              {...{ autoComplete: "off" }}
              onClick={() => changeInput("")}
            >
              {tr("清空")}
            </button>
          </div>
          {replace && (
            <div className="replace-prompt">
              {tr("用示例替换现有输入？")}
              <button
                {...{ autoComplete: "off" }}
                onClick={() => changeInput(example())}
              >
                {tr("替换")}
              </button>
              <button
                {...{ autoComplete: "off" }}
                onClick={() => setReplace(false)}
              >
                {tr("取消")}
              </button>
            </div>
          )}
          {codeLanguage ? (
            <CodeEditor
              id="tool-input"
              label="输入"
              value={input}
              language={codeLanguage}
              dialect={options.dialect}
              indent={options.indent}
              wrap={wrap}
              invalid={!!error}
              onChange={changeInput}
              placeholder="粘贴代码，或点击「加载示例」开始…"
            />
          ) : (
            <textarea
              autoComplete="off"
              aria-label={tr("输入")}
              id="tool-input"
              aria-invalid={!!error}
              aria-describedby={error ? "tool-error" : undefined}
              spellCheck={false}
              value={input}
              onChange={(e) => changeInput(e.target.value)}
              placeholder={
                current.id === "timestamp" && options.direction === "date"
                  ? "2026-09-14 00:00:00"
                  : tr(
                      "在这里粘贴{{name}}内容…\n\n也可以点击「加载示例」开始。",
                      { name: tr(current.name) },
                    )
              }
            />
          )}
          {error && (
            <div id="tool-error" className="error-box" role="alert">
              {tr(error)}
            </div>
          )}
          <div className="action-bar">
            <button
              {...{ autoComplete: "off" }}
              className="primary"
              disabled={busy}
              onClick={() => run()}
            >
              {tr(
                current.id === "timestamp"
                  ? "转换"
                  : current.id === "jwt"
                    ? "解析 JWT"
                    : current.id === "cron"
                      ? "计算执行时间"
                      : current.id === "codec"
                        ? "转换"
                        : current.id === "json-type"
                          ? "生成类型"
                          : current.id === "text"
                            ? "处理"
                            : "格式化",
              )}{" "}
              <span aria-hidden="true">↗</span>
            </button>
            {current.id === "json" && (
              <>
                <button
                  {...{ autoComplete: "off" }}
                  disabled={busy}
                  onClick={() => run("minify")}
                >
                  {tr("压缩")}
                </button>
                <button
                  {...{ autoComplete: "off" }}
                  disabled={busy}
                  onClick={() => run("validate")}
                >
                  {tr("校验")}
                </button>
              </>
            )}
            {busy && (
              <button
                {...{ autoComplete: "off" }}
                onClick={() => {
                  stop();
                  setNotice("已取消处理");
                }}
              >
                {tr("取消处理")}
              </button>
            )}
          </div>
          <div className="editor-footer">
            <span>{tr("{{count}} 字符", { count: input.length })}</span>
            <span>{tr("最大 5 MiB · UTF-8")}</span>
          </div>
        </section>
        <section className="editor-panel output-panel" aria-busy={busy}>
          <div className="editor-header">
            <label htmlFor="tool-output">
              {tr("结果")} <span>OUTPUT</span>
            </label>
            <button
              {...{ autoComplete: "off" }}
              disabled={!hasResult}
              onClick={copy}
            >
              {tr("复制")}
            </button>
            <button
              {...{ autoComplete: "off" }}
              disabled={!hasResult}
              onClick={download}
            >
              {tr("下载")}
            </button>
            <button
              {...{ autoComplete: "off" }}
              disabled={!output}
              onClick={sendToCanvas}
            >
              {tr("发送到代码画布")}
            </button>
          </div>
          <div className="output-wrap">
            {codeLanguage ? (
              <CodeEditor
                id="tool-output"
                label="处理结果"
                value={output}
                language={codeLanguage}
                dialect={options.dialect}
                indent={options.indent}
                wrap={wrap}
                readOnly
              />
            ) : (
              <textarea
                autoComplete="off"
                id="tool-output"
                aria-label={tr("处理结果")}
                readOnly
                value={output}
                spellCheck={false}
              />
            )}
            {!output && (
              <div className="output-empty">
                <span>{tr(busy ? "↻" : error ? "!" : "⌁")}</span>
                <strong>
                  {tr(
                    busy
                      ? "正在本地处理…"
                      : error
                        ? "请检查输入"
                        : hasResult
                          ? "处理完成"
                          : "准备好，随时开始",
                  )}
                </strong>
                <p>
                  {tr(
                    busy
                      ? "你可以随时取消处理"
                      : error
                        ? "修正后再次执行，即可查看结果"
                        : hasResult
                          ? "结果为空（0 字符）。"
                          : "处理结果将显示在这里",
                  )}
                </p>
              </div>
            )}
          </div>
          <div className="editor-footer">
            <span
              className={`result-status ${busy ? "is-busy" : error ? "is-error" : hasResult ? "is-done" : ""}`}
            >
              {tr(
                busy
                  ? "正在处理"
                  : error
                    ? "输入有误"
                    : hasResult
                      ? "处理完成"
                      : "等待处理",
              )}
            </span>
            <span>{tr("浏览器本地计算")}</span>
          </div>
        </section>
      </div>
      <div className="notice" role="status">
        {tr(notice)}
      </div>
      <section className="instructions">
        <h2>{tr("使用说明")}</h2>
        {codeLanguage && (
          <p>
            {tr(
              "Tab 缩进，Shift + Tab 取消缩进；按 Esc 后再按 Tab 可离开编辑器。Ctrl / ⌘ + F 查找，Ctrl / ⌘ + Z 撤销编辑。",
            )}
          </p>
        )}
        <p>{tr(current.hint)}</p>
        <p>
          {tr(
            current.id === "cron"
              ? "选择表达式模式和时区，输入表达式或使用快捷模板，再计算未来 5 次执行时间。搜索范围为未来 5 年。"
              : current.id === "timestamp"
                ? "选择转换方向、单位和时区。日期使用 YYYY-MM-DD HH:mm:ss 格式，结果同时展示 ISO 8601 和两种时间戳。"
                : "粘贴内容或加载示例，选择选项并执行。结果支持复制或下载；错误时请根据提示修正输入。",
          )}
        </p>
        <details>
          <summary>{tr("输入内容会被保存吗？")}</summary>
          <p>
            {tr(
              "不会自动保存到服务器、浏览器存储或 URL。刷新页面会清除输入。只有当你主动选择“发送到代码画布”时，处理结果才会临时写入当前标签页的 sessionStorage，并在代码画布读取后立即删除。主动下载的文件会保存在你的设备上。启用访问统计时仅记录页面与工具操作，不包含输入、输出或错误原文。",
            )}
          </p>
        </details>
        <details>
          <summary>{tr("为什么有时处理会停止？")}</summary>
          <p>
            {tr(
              "单次输入限制为 5 MiB；JSON 最多嵌套 128 层、格式化结果最多约 2000 万字符。处理超过 8 秒会自动终止，请拆分大文本后重试。",
            )}
          </p>
        </details>
      </section>
    </>
  );
}
