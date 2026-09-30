import type { Message } from "../i18n";
import { tr, useLocale } from "../i18n/react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

export default function CanvasPopover({
  label,
  compactLabel,
  title,
  children,
  disabled = false,
  alignEnd = false,
  triggerRef,
}: {
  label: Message;
  compactLabel?: Message;
  title: Message;
  children: ReactNode;
  disabled?: boolean;
  alignEnd?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  useLocale();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const internalTrigger = useRef<HTMLButtonElement>(null);
  const trigger = triggerRef ?? internalTrigger;
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = () => {
      if (panel.current?.matches(":popover-open")) panel.current.hidePopover();
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close);
    };
  }, []);
  return (
    <div className="shot-popover-anchor">
      <button
        ref={trigger}
        popoverTarget={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={id}
        aria-label={tr(label)}
      >
        <span className={compactLabel ? "popover-label-full" : undefined}>
          {tr(label)}
        </span>
        {compactLabel && (
          <span className="popover-label-compact" aria-hidden="true">
            {tr(compactLabel)}
          </span>
        )}{" "}
        <span aria-hidden="true">⌄</span>
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={tr(title)}
        className="shot-popover"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            panel.current?.hidePopover();
            trigger.current?.focus();
          }
        }}
        onBeforeToggle={(event) => {
          if (
            event.newState === "closed" &&
            panel.current?.contains(document.activeElement)
          )
            trigger.current?.focus();
          if (event.newState !== "open" || !panel.current || !trigger.current)
            return;
          const rect = trigger.current.getBoundingClientRect();
          const width = Math.min(360, window.innerWidth - 32);
          panel.current.style.setProperty(
            "--popover-left",
            `${Math.max(16, Math.min(alignEnd ? rect.right - width : rect.left, window.innerWidth - width - 16))}px`,
          );
          panel.current.style.setProperty(
            "--popover-top",
            `${rect.bottom + 8}px`,
          );
          panel.current.style.setProperty(
            "--popover-height",
            `${Math.max(180, window.innerHeight - rect.bottom - 24)}px`,
          );
        }}
        onToggle={(event) => {
          setExpanded(event.newState === "open");
          if (
            event.newState === "open" &&
            !panel.current?.contains(document.activeElement)
          )
            panel.current
              ?.querySelector<HTMLInputElement>("input[type=search]")
              ?.focus();
        }}
      >
        <div className="shot-popover-heading">
          <strong>{tr(title)}</strong>
          <button
            aria-label={tr("关闭{{name}}", { name: tr(title) })}
            popoverTarget={id}
            popoverTargetAction="hide"
          >
            {tr("关闭")}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
