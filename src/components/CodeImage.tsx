import type { Message } from "../i18n";
import { tr, useLocale } from "../i18n/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useId,
  useState,
  type CSSProperties,
} from "react";
import CanvasSettings from "./CanvasSettings";
import CanvasBackground from "./CanvasBackground";
import CanvasPopover from "./CanvasPopover";
import CanvasCode from "./CanvasCode";
import { loadCanvasFont } from "../utils/canvas-fonts";
import { useCanvasHighlight } from "./useCanvasHighlight";
import { canvasReadiness } from "../utils/canvas-readiness";
import { readPreferences, writePreferences } from "../utils/canvas-preferences";
import { readCanvasTransfer } from "../utils/canvas-transfer";
import { sampleForLanguage } from "../utils/code-samples";
import CanvasActions from "./CanvasActions";
import {
  canvasFont,
  defaults,
  themes,
  imagePresets,
  sampleCode,
  validateCode,
  languages,
  languageGroups,
  parseHighlightedLines,
  aspectRatioValue,
  type ImageOptions,
} from "../utils/code-image";

export default function CodeImage() {
  useLocale();
  const [code, setCode] = useState(sampleCode);
  const [language, setLanguage] = useState("typescript");
  const [options, setOptions] = useState<ImageOptions>(defaults);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [fontError, setFontError] = useState("");
  const [fontReady, setFontReady] = useState("");
  const [notice, setNotice] = useState<Message>("");
  const [exporting, setExporting] = useState(false);
  const [replace, setReplace] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const [zoom, setZoom] = useState("fit");
  const [draggingFile, setDraggingFile] = useState(false);
  const [inspector, setInspector] = useState<
    "background" | "appearance" | null
  >(null);
  const inspectorId = useId();
  const [workspaceTop, setWorkspaceTop] = useState(160);
  const backgroundTrigger = useRef<HTMLButtonElement>(null);
  const appearanceTrigger = useRef<HTMLButtonElement>(null);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  useEffect(() => {
    const resize = () =>
      setViewport({ width: innerWidth, height: innerHeight });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  function closeInspector() {
    (inspector === "background"
      ? backgroundTrigger
      : appearanceTrigger
    ).current?.focus();
    setInspector(null);
  }
  function toggleInspector(next: "background" | "appearance") {
    document
      .querySelectorAll(":popover-open")
      .forEach((el) => (el as HTMLElement).hidePopover());
    setInspector((current) => (current === next ? null : next));
  }
  const artwork = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(1000);
  const [autoWidth, setAutoWidth] = useState(720);
  useLayoutEffect(() => {
    if (stage.current)
      setWorkspaceTop(stage.current.getBoundingClientRect().top);
  }, [inspector, viewport]);
  const [size, setSize] = useState({
    width: 0,
    height: 0,
    overflow: false,
    code: "",
    options: defaults,
  });
  const theme = themes[options.theme] || themes.night;
  const {
    tokens,
    highlighted,
    segments,
    error: highlightError,
  } = useCanvasHighlight(code, language);
  const lineCount = code ? code.split(/\r\n|\r|\n/).length : 1;
  const highlightedLines = parseHighlightedLines(
    options.highlightLines,
    options.startLine,
    lineCount,
  );
  useEffect(() => {
    let nextOptions = { ...defaults };
    try {
      nextOptions = readPreferences(localStorage);
    } catch {
      /* Optional storage. */
    }
    try {
      const transfer = readCanvasTransfer(sessionStorage);
      if (transfer) {
        setCode(transfer.code);
        setLanguage(transfer.language);
        nextOptions = { ...nextOptions, title: transfer.title };
        setNotice("已接收其他工具的处理结果，可以直接调整样式并导出。");
      }
    } catch {
      /* Optional storage. */
    }
    setOptions(nextOptions);
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    if (preferencesLoaded) {
      try {
        writePreferences(localStorage, options);
      } catch {
        /* Optional storage. */
      }
    }
  }, [options, preferencesLoaded]);
  useEffect(() => {
    let cancelled = false;
    setFontReady("");
    setFontError("");
    loadCanvasFont(options.fontFamily)
      .then(() => {
        if (!cancelled) setFontReady(options.fontFamily);
      })
      .catch((error) => {
        if (!cancelled) setFontError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [options.fontFamily]);
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver((entries) =>
      setAvailable(entries[0].contentRect.width),
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const node = artwork.current;
    if (!node) return;
    const measure = () => {
      const source = node.querySelector<HTMLElement>(".canvas-highlight");
      const ruler = node.querySelector<HTMLElement>(".canvas-ruler");
      const gutter = node.querySelector<HTMLElement>(".canvas-line-number");
      if (ruler)
        setAutoWidth(
          Math.max(
            420,
            ruler.offsetWidth +
              1 +
              (options.lineNumbers ? (gutter?.offsetWidth || 0) + 24 : 0) +
              options.codePadding * 2,
          ) +
            options.padding * 2,
        );
      setSize({
        width: node.offsetWidth,
        height: node.offsetHeight,
        overflow:
          !!source &&
          source.scrollWidth > (source.parentElement?.clientWidth || 0) + 1,
        code,
        options,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [code, options, fontReady, tokens]);
  const { error, canExport } = canvasReadiness({
    code,
    options,
    size,
    autoWidth,
    highlighted,
    fontReady,
    fontError,
    highlightError,
  });
  const displayScale =
    zoom === "fit"
      ? Math.min(
          1,
          Math.max(0.1, (available - 48) / (size.width || 1)),
          inspector && viewport.width <= 800
            ? Math.max(0.1, (viewport.height * 0.36 - 48) / (size.height || 1))
            : 1,
        )
      : Number(zoom);
  const background =
    options.background === "transparent"
      ? "transparent"
      : options.background === "solid"
        ? options.color
        : options.background === "custom-gradient"
          ? `linear-gradient(${options.gradientAngle}deg, ${options.gradientStart}, ${options.gradientEnd})`
          : options.background === "sunset"
            ? "linear-gradient(135deg, #f4b8a5, #ba9cdf)"
            : options.background === "slate"
              ? "linear-gradient(135deg, #dce3ef, #a8b8d0)"
              : "linear-gradient(135deg, #8ea9ef, #b8a2e6)";
  function update<K extends keyof ImageOptions>(
    key: K,
    value: ImageOptions[K],
  ) {
    setNotice("");
    setOptions((previous) => ({ ...previous, [key]: value }));
  }
  function changeCode(value: string) {
    setCode(value);
    setReplace(false);
    setNotice("");
  }
  async function importFile(file: File) {
    setDraggingFile(false);
    if (file.size > 256 * 1024) {
      setNotice("文件过大，请选择 256 KB 以内的代码文件。");
      return;
    }
    try {
      const text = await file.text();
      validateCode(text);
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const byExtension: Record<string, string> = {
        ts: "typescript",
        js: "javascript",
        jsx: "jsx",
        tsx: "tsx",
        html: "markup",
        htm: "markup",
        css: "css",
        vue: "vue",
        java: "java",
        py: "python",
        go: "go",
        rs: "rust",
        c: "c",
        h: "c",
        cpp: "cpp",
        cc: "cpp",
        cs: "csharp",
        php: "php",
        rb: "ruby",
        kt: "kotlin",
        swift: "swift",
        sh: "bash",
        ps1: "powershell",
        json: "json",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        xml: "xml",
        md: "markdown",
        sql: "sql",
      };
      changeCode(text);
      if (byExtension[ext]) setLanguage(byExtension[ext]);
      setOptions((previous) => ({
        ...previous,
        title: file.name.slice(0, 80),
      }));
      setNotice({
        key: "已导入 {{name}}，内容仅在浏览器中读取。",
        values: { name: file.name },
      });
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "文件读取失败，请重试。",
      );
    }
  }
  const select = (
    label: string,
    value: string,
    items: string[][],
    change: (v: string) => void,
  ) => (
    <label className="shot-field">
      <span className="shot-field-label">{tr(label)}</span>
      <select
        aria-label={tr(label)}
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={exporting}
      >
        {items.map(([v, l]) => (
          <option
            key={v}
            value={v}
            disabled={label === "风格" && v === "custom"}
          >
            {tr(l)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <header className="canvas-heading">
        <h1>{tr("代码画布")}</h1>
        <span>{tr("点击代码直接编辑")}</span>
      </header>
      <div
        className="shot-toolbar canvas-toolbar"
        aria-label={tr("画布工具栏")}
      >
        <CanvasPopover
          label={{
            key: "语言 · {{name}}",
            values: {
              name: tr(languages.find(([id]) => id === language)?.[1]),
            },
          }}
          title="选择语言"
          compactLabel={languages.find(([id]) => id === language)?.[1]}
          disabled={exporting}
        >
          <div className="shot-language-search">
            <input
              type="search"
              aria-label={tr("搜索语言")}
              placeholder={tr("搜索语言，例如 Java、TSX")}
              value={languageSearch}
              onChange={(e) => setLanguageSearch(e.target.value)}
            />
          </div>
          <div className="shot-language-list">
            {languageGroups.map((group) => {
              const items = group.items.filter(([id, name]) =>
                `${id} ${name} ${tr(name)}`
                  .toLowerCase()
                  .includes(languageSearch.trim().toLowerCase()),
              );
              return items.length ? (
                <div key={group.label}>
                  <h3>{tr(group.label)}</h3>
                  {items.map(([id, name]) => (
                    <button
                      key={id}
                      value={id}
                      aria-pressed={language === id}
                      onClick={(e) => {
                        setLanguage(id);
                        setLanguageSearch("");
                        e.currentTarget
                          .closest<HTMLElement>("[popover]")
                          ?.hidePopover();
                      }}
                    >
                      {tr(name)}
                      {language === id && <span aria-hidden="true"> ✓</span>}
                    </button>
                  ))}
                </div>
              ) : null;
            })}
            {!languages.some(([id, name]) =>
              `${id} ${name} ${tr(name)}`
                .toLowerCase()
                .includes(languageSearch.trim().toLowerCase()),
            ) && <p>{tr("未找到匹配语言。")}</p>}
          </div>
        </CanvasPopover>
        {select(
          "风格",
          imagePresets.find(
            (p) =>
              p.theme === options.theme &&
              p.background === options.background &&
              p.padding === options.padding &&
              p.fontSize === options.fontSize &&
              p.fontFamily === options.fontFamily &&
              p.lineHeight === options.lineHeight &&
              p.codePadding === options.codePadding &&
              p.lineNumbers === options.lineNumbers &&
              p.windowStyle === options.windowStyle &&
              p.windowRadius === options.windowRadius &&
              p.shadow === options.shadow &&
              p.aspectRatio === options.aspectRatio &&
              (!("color" in p) || p.color === options.color),
          )?.name || "custom",
          [["custom", "自定义"], ...imagePresets.map((p) => [p.name, p.name])],
          (name) => {
            const preset = imagePresets.find((p) => p.name === name);
            if (!preset) return;
            setNotice("");
            setOptions((o) => ({
              ...o,
              theme: preset.theme,
              background: preset.background,
              padding: preset.padding,
              fontSize: preset.fontSize,
              fontFamily: preset.fontFamily,
              lineHeight: preset.lineHeight,
              codePadding: preset.codePadding,
              lineNumbers: preset.lineNumbers,
              windowStyle: preset.windowStyle,
              windowRadius: preset.windowRadius,
              shadow: preset.shadow,
              aspectRatio: preset.aspectRatio,
              windowBar: true,
              ...("color" in preset ? { color: preset.color } : {}),
            }));
          },
        )}
        <button
          ref={backgroundTrigger}
          aria-controls={inspectorId}
          aria-expanded={inspector === "background"}
          disabled={exporting}
          onClick={() => toggleInspector("background")}
        >
          {tr("背景")} <span aria-hidden="true">⌄</span>
        </button>
        <button
          ref={appearanceTrigger}
          aria-controls={inspectorId}
          aria-expanded={inspector === "appearance"}
          disabled={exporting}
          onClick={() => toggleInspector("appearance")}
        >
          {tr("外观设置")} <span aria-hidden="true">⌄</span>
        </button>

        <CanvasPopover
          label="代码操作"
          compactLabel="代码"
          title="代码操作"
          disabled={exporting}
        >
          <div className="canvas-code-menu">
            <p id="canvas-help">
              {tr(
                "点击代码直接编辑 · Tab 缩进 · Esc 后 Tab 离开 · Ctrl / ⌘ + F 查找",
              )}
            </p>
            <button
              disabled={exporting}
              onClick={() => {
                document
                  .querySelectorAll(":popover-open")
                  .forEach((el) => (el as HTMLElement).hidePopover());
                if (code) setReplace(true);
                else changeCode(sampleForLanguage(language));
              }}
            >
              {tr("加载示例")}
            </button>
            <button
              disabled={exporting}
              onClick={(event) => {
                changeCode("");
                event.currentTarget
                  .closest<HTMLElement>("[popover]")
                  ?.hidePopover();
              }}
            >
              {tr("清空")}
            </button>
            <label className="canvas-file-import">
              {tr("导入文件")}
              <input
                type="file"
                disabled={exporting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void importFile(file);
                    event.currentTarget
                      .closest<HTMLElement>("[popover]")
                      ?.hidePopover();
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </CanvasPopover>
        <CanvasActions
          artwork={artwork}
          options={options}
          canExport={canExport}
          exporting={exporting}
          setExporting={setExporting}
          setNotice={setNotice}
          update={update}
        />
      </div>
      {replace && (
        <div className="replace-prompt">
          {tr("用当前语言的示例替换代码？")}
          <button onClick={() => changeCode(sampleForLanguage(language))}>
            {tr("替换")}
          </button>
          <button onClick={() => setReplace(false)}>{tr("取消")}</button>
        </div>
      )}
      <div
        className={`canvas-workspace ${inspector ? "has-inspector" : ""}`}
        style={{ "--workspace-top": `${workspaceTop}px` } as CSSProperties}
      >
        <div
          className={`canvas-stage ${options.background === "transparent" ? "is-transparent" : ""} ${draggingFile ? "is-dragging" : ""}`}
          ref={stage}
          aria-label={tr("画布工作区")}
          aria-busy={exporting}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!exporting) setDraggingFile(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!exporting) event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDraggingFile(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (exporting) return;
            const file = event.dataTransfer.files[0];
            if (file) void importFile(file);
            else setDraggingFile(false);
          }}
        >
          <div
            className="canvas-frame"
            style={{
              width: size.width ? size.width * displayScale : undefined,
              height: size.height ? size.height * displayScale : undefined,
            }}
          >
            <div
              className="canvas-artwork"
              ref={artwork}
              style={
                {
                  padding: options.padding,
                  width:
                    options.widthMode === "fixed" &&
                    Number.isFinite(options.width)
                      ? Math.max(320, Math.min(2400, options.width))
                      : autoWidth,
                  background,
                  aspectRatio: aspectRatioValue(options.aspectRatio),
                  transform: `scale(${displayScale})`,
                  font: canvasFont(options),
                  fontVariantLigatures: "none",
                  lineHeight: `${Math.ceil(options.fontSize * options.lineHeight)}px`,
                  color: theme.text,
                } as CSSProperties
              }
            >
              <div
                className="canvas-measure"
                data-export-ignore
                aria-hidden="true"
              >
                <span className="canvas-ruler">{code || " "}</span>
              </div>
              <div
                className="canvas-window"
                style={{
                  background: theme.bg,
                  minWidth: options.widthMode === "fixed" ? 0 : 420,
                  borderRadius: options.windowRadius,
                  boxShadow:
                    options.shadow === "none"
                      ? "none"
                      : options.shadow === "strong"
                        ? "0 18px 42px #17203a55"
                        : "0 10px 24px #17203a33",
                  overflow: "hidden",
                }}
              >
                {options.windowBar && options.windowStyle !== "none" && (
                  <div
                    className={`canvas-windowbar style-${options.windowStyle}`}
                  >
                    {options.windowStyle === "mac" && (
                      <div className="canvas-window-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                    {options.windowStyle === "minimal" && (
                      <div className="canvas-window-minimal" aria-hidden="true">
                        •••
                      </div>
                    )}
                    <div
                      className="canvas-title"
                      style={{ color: theme.muted }}
                    >
                      <span aria-hidden="true">
                        {options.title || "\u00a0"}
                      </span>
                      <input
                        data-export-ignore
                        aria-label={tr("窗口标题")}
                        placeholder={tr("添加标题…")}
                        value={options.title}
                        maxLength={80}
                        disabled={exporting}
                        onChange={(event) =>
                          update("title", event.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
                <div
                  className="canvas-code-padding"
                  style={{ padding: options.codePadding }}
                >
                  <CanvasCode
                    code={code}
                    segments={segments}
                    colors={theme.colors}
                    muted={theme.muted}
                    lineNumbers={options.lineNumbers}
                    startLine={options.startLine}
                    highlightedLines={highlightedLines}
                    wrap={options.widthMode === "fixed" && options.wrap}
                    readOnly={exporting}
                    onChange={changeCode}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {inspector && (
          <aside
            id={inspectorId}
            className="canvas-inspector"
            role="dialog"
            aria-modal="false"
            aria-label={tr(
              inspector === "background" ? "背景设置" : "外观设置",
            )}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeInspector();
              }
            }}
          >
            <div className="shot-popover-heading">
              <strong>
                {tr(inspector === "background" ? "背景设置" : "外观设置")}
              </strong>
              <button
                aria-label={tr("关闭{{name}}", {
                  name: tr(
                    inspector === "background" ? "背景设置" : "外观设置",
                  ),
                })}
                onClick={closeInspector}
              >
                {tr("关闭")}
              </button>
            </div>
            {inspector === "background" ? (
              <CanvasBackground
                options={options}
                update={update}
                exporting={exporting}
              />
            ) : (
              <CanvasSettings
                options={options}
                update={update}
                exporting={exporting}
                onReset={() =>
                  setOptions({ ...defaults, title: options.title })
                }
              />
            )}
          </aside>
        )}
      </div>
      <div className="canvas-statusbar">
        <span>{tr("{{count}} / 12,000 字符", { count: code.length })}</span>
        <span>
          {tr("画布 {{width}} × {{height}} px", {
            width: size.width,
            height: size.height,
          })}
        </span>
        <span>
          {tr("导出 {{width}} × {{height}} px", {
            width: size.width * options.scale,
            height: size.height * options.scale,
          })}
        </span>
        <label>
          {tr("画布缩放")}
          <select
            aria-label={tr("画布缩放")}
            value={zoom}
            onChange={(event) => setZoom(event.target.value)}
          >
            <option value="fit">{tr("适应宽度")}</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.5">150%</option>
          </select>
        </label>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {tr(error)}
        </div>
      )}
      <div className="notice" role="status">
        {tr(notice || (!error && !canExport ? "正在准备字体与高亮…" : ""))}
      </div>
      <section className="instructions canvas-instructions">
        <details>
          <summary>{tr("使用说明 · 编辑与导出")}</summary>
          <p>
            {tr(
              "在画布上直接输入代码、修改标题。可自定义渐变背景、窗口样式、画布比例、起始行号和高亮行；缩放只影响查看比例，导出使用实际尺寸。PNG / SVG 不包含光标、选区和操作控件。支持 28 种语言与格式，以及 1× / 2× / 3× PNG 导出。中文和未覆盖字符使用系统字体回退。",
            )}
          </p>
          <p>
            {tr(
              "所有内容在浏览器内处理，不执行或上传代码。仅记住外观设置，不保存代码或标题。最多支持 12,000 字符、160 行和 1600 万导出像素；长行可在外观设置中指定宽度并自动换行。",
            )}
          </p>
        </details>
      </section>
    </>
  );
}
