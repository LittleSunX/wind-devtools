import type { ComponentType } from "react";
import { tools, type ToolDefinition } from "./catalog";
import type { Language } from "./i18n";
import { parseLocalizedPath } from "./i18n/routing";

export type PageProps = {
  current?: ToolDefinition;
  language: Language;
};
export type PageComponent = ComponentType<PageProps>;

export function pageModule(path: string) {
  const normalized = parseLocalizedPath(path).path;
  if (normalized === "/" || normalized === "/tools")
    return "src/components/ToolDirectory.tsx";
  const current = tools.find((tool) => normalized === `/tools/${tool.id}`);
  if (!current) return null;
  if (current.id === "code-image") return "src/components/CodeImage.tsx";
  if (current.id === "diff") return "src/components/DiffTool.tsx";
  return "src/components/TextToolPage.tsx";
}

// Resolve the complete page before hydration, so server HTML stays visible while
// its route chunk loads and the initial client tree matches the pre-render.
export async function loadPage(path: string): Promise<PageComponent | null> {
  switch (pageModule(path)) {
    case "src/components/ToolDirectory.tsx":
      return (await import("./components/ToolDirectory")).default;
    case "src/components/CodeImage.tsx":
      return (await import("./components/CodeImage")).default;
    case "src/components/DiffTool.tsx":
      return (await import("./components/DiffTool")).default;
    case "src/components/TextToolPage.tsx": {
      const TextToolPage = (await import("./components/TextToolPage")).default;
      return function TextPage({ current, language }) {
        return current ? (
          <TextToolPage current={current} language={language} />
        ) : null;
      };
    }
    default:
      return null;
  }
}
