import { validateCode, type ImageOptions } from "./code-image";

export type CanvasSize = {
  width: number;
  height: number;
  overflow: boolean;
  code: string;
  options: ImageOptions;
};

export function canvasReadiness({
  code,
  options,
  size,
  autoWidth,
  highlighted,
  fontReady,
  fontError,
  highlightError,
}: {
  code: string;
  options: ImageOptions;
  size: CanvasSize;
  autoWidth: number;
  highlighted: boolean;
  fontReady: string;
  fontError: string;
  highlightError: string;
}) {
  let validation = "";
  try {
    validateCode(code);
  } catch (error) {
    validation = (error as Error).message;
  }
  if (
    options.widthMode === "fixed" &&
    (!Number.isInteger(options.width) ||
      options.width < 320 ||
      options.width > 2400)
  )
    validation = "画布宽度请输入 320–2400 之间的整数（px）。";
  else if (!validation && size.width > 2400)
    validation = "单行代码太长，请指定宽度并开启长行换行，或缩小字号。";
  else if (
    !validation &&
    options.widthMode === "fixed" &&
    !options.wrap &&
    size.overflow
  )
    validation = "代码超出指定宽度，请开启长行自动换行或增加宽度。";
  const pngError =
    !validation &&
    (size.width * size.height * options.scale ** 2 > 16000000 ||
      size.height * options.scale > 12000)
      ? "图片尺寸过大，请减少代码、字号、行高或导出倍率。"
      : "";
  const renderError = validation || fontError || highlightError;
  const canExportSvg =
    !renderError &&
    highlighted &&
    fontReady === options.fontFamily &&
    size.code === code &&
    size.options === options &&
    size.width > 0 &&
    (options.widthMode === "fixed" || size.width === autoWidth);
  return {
    error: renderError || pngError,
    pngError,
    canExportSvg,
    canExport: canExportSvg && !pngError,
  };
}
