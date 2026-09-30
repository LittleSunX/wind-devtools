import { useEffect, useId, useRef, useState } from "react";
import { i18n, languageKey, supportedLanguages, type Language } from "../i18n";
import { localizedPath, parseLocalizedPath } from "../i18n/routing";
import { tr, useLocale } from "../i18n/react";

export default function LanguageSwitcher() {
  const language = useLocale();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const current =
    supportedLanguages.find(({ id }) => id === language) ??
    supportedLanguages[0];
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  }, [language]);
  useEffect(() => {
    const close = () => {
      if (menu.current?.matches(":popover-open")) menu.current.hidePopover();
    };
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  function switchLanguage(next: Language) {
    menu.current?.hidePopover();
    trigger.current?.focus();
    if (next === language) return;
    const route = parseLocalizedPath(window.location.pathname).path;
    const nextPath = localizedPath(route, next);
    history.replaceState(
      history.state,
      "",
      `${nextPath}${window.location.search}${window.location.hash}`,
    );
    void i18n.changeLanguage(next);
    const canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (canonical) canonical.href = new URL(nextPath, location.origin).href;
    try {
      localStorage.setItem(languageKey, next);
    } catch {
      /* Switching still works. */
    }
  }

  return (
    <div className="language-control">
      <button
        ref={trigger}
        type="button"
        className="language-trigger"
        aria-label={`${tr("界面语言")} · ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-controls={id}
        popoverTarget={id}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          menu.current?.showPopover();
          menu.current
            ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
            ?.focus();
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.3 3 14.7 0 18-3-3.3-3-14.7 0-18Z" />
        </svg>
        <span
          className="language-label"
          lang={language === "zh" ? "zh-CN" : language}
        >
          {current.label}
        </span>
        <svg
          className="language-chevron"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      <div
        ref={menu}
        id={id}
        className="language-menu"
        popover="auto"
        role="menu"
        aria-label={tr("界面语言")}
        onBeforeToggle={(event) => {
          if (event.newState !== "open" || !menu.current || !trigger.current)
            return;
          const rect = trigger.current.getBoundingClientRect();
          menu.current.style.left = `${Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168))}px`;
          menu.current.style.top = `${rect.bottom + 6}px`;
        }}
        onToggle={(event) => {
          setExpanded(event.newState === "open");
          if (
            event.newState === "open" &&
            !menu.current?.contains(document.activeElement)
          )
            menu.current
              ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
              ?.focus();
        }}
        onKeyDown={(event) => {
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
          );
          const index = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          let next: number;
          if (event.key === "ArrowDown") next = (index + 1) % items.length;
          else if (event.key === "ArrowUp")
            next = (index - 1 + items.length) % items.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = items.length - 1;
          else if (event.key === "Escape") {
            event.preventDefault();
            menu.current?.hidePopover();
            trigger.current?.focus();
            return;
          } else if (event.key === "Tab") {
            menu.current?.hidePopover();
            return;
          } else return;
          event.preventDefault();
          items[next]?.focus();
        }}
      >
        {supportedLanguages.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="menuitemradio"
            className="language-menu-option"
            lang={id === "zh" ? "zh-CN" : id}
            aria-checked={language === id}
            onClick={() => switchLanguage(id)}
          >
            <span>{label}</span>
            {language === id && (
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="m3 8 3 3 7-7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
