import type { Message } from "../i18n";
import { tr, useLocale } from "../i18n/react";
import { useEffect, useRef, type RefObject } from "react";
import CanvasPopover from "./CanvasPopover";
import {
  blobToDataUrl,
  dataUrlToBase64,
  exportCanvas,
  exportCanvasSvg,
  exportCanvasSvgSource,
  loadExportImage,
} from "../utils/canvas-export";
import { imageFilename, type ImageOptions } from "../utils/code-image";
import { trackTool } from "../analytics";

type Props = {
  artwork: RefObject<HTMLDivElement | null>;
  options: ImageOptions;
  canExport: boolean;
  canExportSvg: boolean;
  pngError: string;
  size: { width: number; height: number };
  exporting: boolean;
  setExporting: (value: boolean) => void;
  setNotice: (value: Message) => void;
  update: <K extends keyof ImageOptions>(
    key: K,
    value: ImageOptions[K],
  ) => void;
};

export default function CanvasActions({
  artwork,
  options,
  canExport,
  canExportSvg,
  pngError,
  size,
  exporting,
  setExporting,
  setNotice,
  update,
}: Props) {
  const locale = useLocale();
  const pngCache = useRef<{ key: string; blob: Blob } | null>(null);

  const activePreview = useRef<AbortController | null>(null);
  useEffect(() => () => activePreview.current?.abort(), []);

  function renderPng(signal?: AbortSignal) {
    signal?.throwIfAborted();
    const node = artwork.current;
    if (!node) throw new Error("画布尚未准备好，请重试。");
    // The artwork markup includes code, syntax colors, title and visual options.
    // Dimensions and scale also affect the PNG but are not fully reflected in HTML.
    const key = `${node.offsetWidth}:${node.offsetHeight}:${options.scale}:${options.fontFamily}:${node.outerHTML}`;
    if (pngCache.current?.key === key)
      return Promise.resolve(pngCache.current.blob);
    return exportCanvas(node, options, signal).then((blob) => {
      signal?.throwIfAborted();
      pngCache.current = { key, blob };
      return blob;
    });
  }

  function hideActionMenu(target: HTMLElement) {
    target.closest<HTMLElement>("[popover]")?.hidePopover();
  }

  async function copyImage() {
    if (!canExport || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
        throw new Error("当前浏览器不支持复制图片，请下载 PNG。");
      const blob = renderPng();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setNotice("图片已复制，可以粘贴到支持图片的应用。");
      trackTool("code-image", "copy_image", "success");
    } catch {
      trackTool("code-image", "copy_image", "error");
      setNotice("复制失败或未获剪贴板权限，请使用「下载 PNG」。");
    } finally {
      setExporting(false);
    }
  }

  async function copySvgSource() {
    if (!canExportSvg || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      const source = await exportCanvasSvgSource(artwork.current, options);
      await navigator.clipboard.writeText(source);
      setNotice("SVG 源码已复制。");
      trackTool("code-image", "copy_svg", "success");
    } catch (error) {
      trackTool("code-image", "copy_svg", "error");
      setNotice(
        error instanceof Error ? error.message : "SVG 源码复制失败，请重试。",
      );
    } finally {
      setExporting(false);
    }
  }

  async function copyPngText(mode: "data-url" | "base64") {
    if (!canExport || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    const action = mode === "data-url" ? "copy_data_url" : "copy_base64";
    try {
      const blob = await renderPng();
      const dataUrl = await blobToDataUrl(blob);
      await navigator.clipboard.writeText(
        mode === "data-url" ? dataUrl : dataUrlToBase64(dataUrl),
      );
      setNotice(
        mode === "data-url" ? "PNG Data URL 已复制。" : "PNG Base64 已复制。",
      );
      trackTool("code-image", action, "success");
    } catch (error) {
      trackTool("code-image", action, "error");
      setNotice(
        error instanceof Error ? error.message : "复制失败，请检查剪贴板权限。",
      );
    } finally {
      setExporting(false);
    }
  }

  async function openPngPreview() {
    if (!canExport || !artwork.current || exporting) return;
    const preview = window.open("", "_blank") as
      (Window & typeof globalThis) | null;
    if (!preview) {
      setNotice("新标签页被浏览器拦截，请允许弹出窗口后重试。");
      trackTool("code-image", "open_image", "error");
      return;
    }
    preview.opener = null;
    const document = preview.document;
    const previewURL = preview.URL;
    const controller = new AbortController();
    activePreview.current = controller;
    let previewLeft = false;
    const isCurrent = () => {
      try {
        return !previewLeft && !preview.closed && preview.document === document;
      } catch {
        return false;
      }
    };
    const cancel = () => controller.abort();
    const leavePreview = () => {
      previewLeft = true;
      cancel();
    };
    preview.addEventListener("pagehide", leavePreview, { once: true });
    const leaveEditor = () => {
      cancel();
      if (isCurrent()) preview.close();
    };
    window.addEventListener("pagehide", leaveEditor, { once: true });
    // Some browsers do not dispatch pagehide when a tab is closed.
    const closedCheck = setInterval(() => {
      if (!isCurrent()) leavePreview();
    }, 250);
    let imageTimer: ReturnType<typeof setTimeout> | undefined;
    let release: (() => void) | undefined;
    setExporting(true);
    setNotice("");
    try {
      document.title = tr("PNG 预览");
      document.documentElement.lang = locale.startsWith("en") ? "en" : "zh";
      document.body.style.cssText =
        "min-height:100vh;margin:0;display:grid;place-items:center;background:#f6f8fc;color:#36445c;font:16px system-ui,sans-serif";
      const loading = document.createElement("p");
      loading.setAttribute("role", "status");
      loading.textContent = tr("正在生成 PNG 预览…");
      document.body.replaceChildren(loading);

      const blob = await renderPng(controller.signal);
      if (!isCurrent()) return;
      // The preview owns the URL, so it stays usable if the editor is reloaded.
      const url = previewURL.createObjectURL(blob);
      release = () => previewURL.revokeObjectURL(url);
      preview.addEventListener("pagehide", release, { once: true });
      const image = document.createElement("img");
      image.alt = tr("PNG 预览");
      image.style.cssText = "display:block;max-width:100%;height:auto";
      imageTimer = setTimeout(
        () => controller.abort(new Error("无法打开图片，请重试。")),
        10000,
      );
      await loadExportImage(image, url, controller.signal);
      if (!isCurrent()) return;
      document.body.style.cssText =
        "min-height:100vh;margin:0;padding:24px;box-sizing:border-box;display:grid;place-items:center;background:#f6f8fc";
      document.body.replaceChildren(image);
      setNotice("已在新标签页打开 PNG。");
      trackTool("code-image", "open_image", "success");
    } catch (error) {
      if (release) {
        if (isCurrent()) preview.removeEventListener("pagehide", release);
        release();
      }
      // Closing/navigating the tab is cancellation, not an export failure.
      if (!isCurrent()) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        preview.close();
        return;
      }
      // Do not repeatedly serve a PNG that the browser could not display.
      pngCache.current = null;
      const message =
        error instanceof Error ? error.message : "无法打开图片，请重试。";
      const alert = document.createElement("p");
      alert.setAttribute("role", "alert");
      alert.textContent = tr(message);
      document.body.replaceChildren(alert);
      trackTool("code-image", "open_image", "error");
      setNotice(message);
    } finally {
      clearTimeout(imageTimer);
      clearInterval(closedCheck);
      if (isCurrent()) preview.removeEventListener("pagehide", leavePreview);
      window.removeEventListener("pagehide", leaveEditor);
      if (activePreview.current === controller) activePreview.current = null;
      setExporting(false);
    }
  }

  async function downloadPng() {
    if (!canExport || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      const blob = await renderPng();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = imageFilename();
      link.style.display = "none";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("PNG 已生成。");
      trackTool("code-image", "export", "success");
    } catch (error) {
      trackTool("code-image", "export", "error");
      setNotice(
        error instanceof Error ? error.message : "PNG 导出失败，请重试。",
      );
    } finally {
      setExporting(false);
    }
  }

  async function downloadSvg() {
    if (!canExportSvg || !artwork.current || exporting) return;
    setExporting(true);
    setNotice("");
    try {
      const dataUrl = await exportCanvasSvg(artwork.current, options);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = imageFilename(new Date(), "svg");
      link.style.display = "none";
      document.body.append(link);
      link.click();
      link.remove();
      setNotice("SVG 已生成。");
      trackTool("code-image", "export_svg", "success");
    } catch (error) {
      trackTool("code-image", "export_svg", "error");
      setNotice(
        error instanceof Error ? error.message : "SVG 导出失败，请重试。",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="canvas-export-actions">
      {/* Firefox restores dynamic disabled state on reload unless autocomplete
          is off. Use its button extension without augmenting React's types. */}
      <button
        {...{ autoComplete: "off" }}
        type="button"
        className="canvas-quick-copy"
        aria-label={tr("快速复制图片")}
        disabled={!canExport || exporting}
        onClick={() => void copyImage()}
      >
        {tr("复制图片")}
      </button>
      <CanvasPopover
        alignEnd
        label="复制"
        title="复制"
        disabled={!canExportSvg || exporting}
      >
        <div className="canvas-action-menu">
          <button
            {...{ autoComplete: "off" }}
            type="button"
            aria-label={tr("复制图片")}
            disabled={!canExport || exporting}
            onClick={(event) => {
              hideActionMenu(event.currentTarget);
              void copyImage();
            }}
          >
            <span>{tr("复制图片")}</span>
            <small>PNG</small>
          </button>
          <button
            {...{ autoComplete: "off" }}
            type="button"
            aria-label={tr("在新标签页打开")}
            disabled={!canExport || exporting}
            onClick={(event) => {
              hideActionMenu(event.currentTarget);
              void openPngPreview();
            }}
          >
            <span>{tr("在新标签页打开")}</span>
            <small>{tr("PNG 预览")}</small>
          </button>
          <details className="canvas-advanced-copy">
            <summary>{tr("高级复制")}</summary>
            <button
              {...{ autoComplete: "off" }}
              type="button"
              aria-label={tr("复制 SVG 源码")}
              disabled={!canExportSvg || exporting}
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void copySvgSource();
              }}
            >
              <span>{tr("复制 SVG 源码")}</span>
              <small>SVG</small>
            </button>
            <button
              {...{ autoComplete: "off" }}
              type="button"
              aria-label={tr("复制 PNG Data URL")}
              disabled={!canExport || exporting}
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void copyPngText("data-url");
              }}
            >
              <span>{tr("复制 PNG Data URL")}</span>
              <small>data:image/png</small>
            </button>
            <button
              {...{ autoComplete: "off" }}
              type="button"
              aria-label={tr("复制 PNG Base64")}
              disabled={!canExport || exporting}
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void copyPngText("base64");
              }}
            >
              <span>{tr("复制 PNG Base64")}</span>
              <small>{tr("纯 Base64")}</small>
            </button>
          </details>
        </div>
      </CanvasPopover>

      <button
        {...{ autoComplete: "off" }}
        type="button"
        className="primary canvas-quick-export"
        aria-label={tr("快速下载 PNG")}
        disabled={!canExport || exporting}
        onClick={() => void downloadPng()}
      >
        {tr(exporting ? "正在导出…" : "下载 PNG")}
        <span aria-hidden="true">↓</span>
      </button>
      <CanvasPopover
        alignEnd
        label={exporting ? "正在导出…" : "导出"}
        title="导出"
        disabled={!canExportSvg || exporting}
      >
        <div className="canvas-export-menu">
          <div className="canvas-export-dimensions">
            <strong>{tr("导出尺寸")}</strong>
            <span>
              {size.width * options.scale} × {size.height * options.scale} px
            </span>
          </div>
          <div
            className="canvas-export-scale"
            role="group"
            aria-label={tr("PNG 导出倍率")}
          >
            <span>{tr("PNG 导出倍率")}</span>
            <div>
              {[1, 2, 3].map((scale) => (
                <button
                  {...{ autoComplete: "off" }}
                  type="button"
                  key={scale}
                  aria-pressed={options.scale === scale}
                  disabled={exporting}
                  onClick={() => update("scale", scale)}
                >
                  {scale}×
                </button>
              ))}
            </div>
          </div>
          {pngError && (
            <p className="canvas-export-warning" role="status">
              {tr(pngError)}
            </p>
          )}
          <div className="canvas-action-menu">
            <button
              {...{ autoComplete: "off" }}
              type="button"
              aria-label={tr("下载 PNG")}
              disabled={!canExport || exporting}
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void downloadPng();
              }}
            >
              <span>{tr("下载 PNG")}</span>
              <small>{options.scale}×</small>
            </button>
            <button
              {...{ autoComplete: "off" }}
              type="button"
              aria-label={tr("下载 SVG")}
              disabled={!canExportSvg || exporting}
              onClick={(event) => {
                hideActionMenu(event.currentTarget);
                void downloadSvg();
              }}
            >
              <span>{tr("下载 SVG")}</span>
              <small>{tr("SVG · 不受倍率影响")}</small>
            </button>
          </div>
        </div>
      </CanvasPopover>
    </div>
  );
}
