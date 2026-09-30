import { tr, useLocale } from "../i18n/react";
import type { ImageOptions } from "../utils/code-image";
export default function CanvasBackground({
  options,
  update,
  exporting,
}: {
  options: ImageOptions;
  update: <K extends keyof ImageOptions>(
    key: K,
    value: ImageOptions[K],
  ) => void;
  exporting: boolean;
}) {
  useLocale();
  const select = (
    label: string,
    value: string,
    items: string[][],
    change: (value: string) => void,
  ) => (
    <label className="shot-field shot-wide">
      {tr(label)}
      <select
        aria-label={tr(label)}
        value={value}
        disabled={exporting}
        onChange={(event) => change(event.target.value)}
      >
        {items.map(([id, label]) => (
          <option key={id} value={id}>
            {tr(label)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="shot-settings">
      {select(
        "背景",
        options.background,
        [
          ["blue", "蓝紫渐变"],
          ["sunset", "日落渐变"],
          ["slate", "雾灰渐变"],
          ["solid", "纯色"],
          ["custom-gradient", "自定义渐变"],
          ["transparent", "透明"],
        ],
        (v) => update("background", v),
      )}
      {options.background === "solid" && (
        <label className="shot-field">
          {tr("背景颜色")}
          <input
            type="color"
            aria-label={tr("背景颜色")}
            value={options.color}
            onChange={(e) => update("color", e.target.value)}
            disabled={exporting}
          />
        </label>
      )}
      {options.background === "custom-gradient" && (
        <>
          <label className="shot-field">
            {tr("渐变起始色")}
            <input
              type="color"
              aria-label={tr("渐变起始色")}
              value={options.gradientStart}
              onChange={(e) => update("gradientStart", e.target.value)}
              disabled={exporting}
            />
          </label>
          <label className="shot-field">
            {tr("渐变结束色")}
            <input
              type="color"
              aria-label={tr("渐变结束色")}
              value={options.gradientEnd}
              onChange={(e) => update("gradientEnd", e.target.value)}
              disabled={exporting}
            />
          </label>
          <label className="shot-field shot-wide">
            {tr("渐变角度 ·")} {options.gradientAngle}°
            <input
              type="range"
              aria-label={tr("渐变角度")}
              min={0}
              max={360}
              step={15}
              value={options.gradientAngle}
              onChange={(e) => update("gradientAngle", Number(e.target.value))}
              disabled={exporting}
            />
          </label>
        </>
      )}
    </div>
  );
}
