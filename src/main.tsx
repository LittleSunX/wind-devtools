import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { i18n, languageKey, resolveLanguage, tr } from "./i18n";
import { parseLocalizedPath } from "./i18n/routing";
import { loadPage, type PageComponent } from "./pages";
import "./styles.css";

function readSavedLanguage() {
  try {
    return localStorage.getItem(languageKey);
  } catch {
    return null;
  }
}

async function bootstrap() {
  const root = document.getElementById("root")!;
  // Static HTML can appear before its route chunk has evaluated. Keep form
  // input and clicks from being lost until React attaches their handlers.
  root.inert = true;
  const requested = parseLocalizedPath(window.location.pathname);
  let language = requested.language;
  if (window.location.pathname === "/") {
    language = resolveLanguage(readSavedLanguage(), navigator.languages);
    if (language === "en") {
      window.location.replace(
        `/en/tools${window.location.search}${window.location.hash}`,
      );
      return;
    }
  }
  await i18n.changeLanguage(language);
  const htmlLanguage = language === "zh" ? "zh-CN" : "en";
  const canHydrate = document.documentElement.lang === htmlLanguage;
  document.documentElement.lang = htmlLanguage;
  const Page = await loadPage(window.location.pathname);
  mount(canHydrate, Page);
}

void bootstrap().catch(() => {
  const root = document.getElementById("root")!;
  root.inert = false;
  const notice = document.createElement("div");
  notice.className = "error-box";
  notice.setAttribute("role", "alert");
  notice.textContent = tr("页面加载失败，请刷新重试。");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = tr("重新加载");
  retry.addEventListener("click", () => window.location.reload());
  notice.append(" ", retry);
  root.prepend(notice);
});

function mount(canHydrate: boolean, Page: PageComponent | null) {
  const root = document.getElementById("root")!;
  const app = (
    <React.StrictMode>
      <App path={window.location.pathname} Page={Page} />
    </React.StrictMode>
  );
  if (root.querySelector(".app") && canHydrate) hydrateRoot(root, app);
  else {
    root.replaceChildren();
    createRoot(root).render(app);
  }

  void import("./analytics").then(({ initAnalytics }) => initAnalytics());
}
