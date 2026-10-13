import { useEffect } from "react";
import type { Language } from "./i18n";
import { localizedPath, parseLocalizedPath } from "./i18n/routing";
import { tr, useLocale } from "./i18n/react";
import { pageMetadata } from "./seo";
import { tools } from "./catalog";
import AppLayout from "./components/AppLayout";
import type { PageComponent } from "./pages";

export function App({
  path = "/tools",
  Page,
}: {
  path?: string;
  Page: PageComponent | null;
}) {
  const locale = useLocale();
  const normalized = parseLocalizedPath(path).path;
  const language: Language = locale === "en" ? "en" : "zh";
  const current = tools.find((tool) => normalized === `/tools/${tool.id}`);
  const isHome = normalized === "/" || normalized === "/tools";
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.inert = false;
      root.dataset.hydrated = "true";
    }
  }, []);
  useEffect(() => {
    const meta = pageMetadata({ language, tool: current, isHome });
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", meta.description);
  }, [language, current, isHome]);
  return (
    <AppLayout current={current} isHome={isHome} language={language}>
      {Page ? (
        <Page current={current} language={language} />
      ) : (
        <section className="not-found">
          <span className="eyebrow">404 / NOT FOUND</span>
          <h1>{tr("这个工具还不存在。")}</h1>
          <p>{tr("回到工具箱，寻找你需要的工具。")}</p>
          <a className="primary" href={localizedPath("/tools", language)}>
            {tr("返回工具箱 ↗")}
          </a>
        </section>
      )}
    </AppLayout>
  );
}
