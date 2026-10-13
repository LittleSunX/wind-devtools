import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import type { ToolDefinition } from "../src/catalog";
import type { Language } from "../src/i18n";
import { createServer, loadEnv } from "vite";
import { buildOrigin } from "./site-config";

const template = await readFile("dist/index.html", "utf8");
const origin = buildOrigin(
  { ...loadEnv("production", process.cwd(), ""), ...process.env },
  {
    production: process.argv.includes("--production"),
    preview: process.argv.includes("--preview"),
  },
);

// Vite's SSR loader understands route-local CSS and shares the same modules as
// the browser. Resolve each page before rendering instead of emitting a lazy
// placeholder into the static HTML.
const server = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { App } = await server.ssrLoadModule("/src/App.tsx");
  const { tools } = (await server.ssrLoadModule(
    "/src/catalog.ts",
  )) as typeof import("../src/catalog");
  const { i18n } = (await server.ssrLoadModule(
    "/src/i18n/index.ts",
  )) as typeof import("../src/i18n");
  const { alternatePaths, localizedPath } = (await server.ssrLoadModule(
    "/src/i18n/routing.ts",
  )) as typeof import("../src/i18n/routing");
  const { pageMetadata } = (await server.ssrLoadModule(
    "/src/seo.ts",
  )) as typeof import("../src/seo");
  const { loadPage, pageModule } = (await server.ssrLoadModule(
    "/src/pages.tsx",
  )) as typeof import("../src/pages");
  type ManifestEntry = { file: string; css?: string[]; imports?: string[] };
  let manifest: Record<string, ManifestEntry> = {};
  try {
    manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
  } catch {
    // Source-template fixtures exercise SEO without a preceding Vite build.
  }

  function routeAssets(path: string) {
    const module = pageModule(path);
    if (!module || !manifest[module]) return "";
    const visited = new Set<string>();
    const assets = new Set<string>();
    function visit(key: string) {
      if (visited.has(key)) return;
      visited.add(key);
      const entry = manifest[key];
      if (!entry) return;
      for (const dependency of entry.imports ?? []) visit(dependency);
      for (const css of entry.css ?? [])
        if (!template.includes(`href="/${css}"`))
          assets.add(`<link rel="stylesheet" href="/${css}"/>`);
      if (
        !template.includes(`src="/${entry.file}"`) &&
        !template.includes(`href="/${entry.file}"`)
      )
        assets.add(`<link rel="modulepreload" href="/${entry.file}"/>`);
    }
    visit(module);
    return [...assets].join("");
  }

  const canonicalRoutes = [
    { path: "/tools", tool: undefined },
    ...tools.map((tool) => ({ path: `/tools/${tool.id}`, tool })),
  ];

  function seoLinks(path: string, publicPath: string) {
    if (!origin) return "";
    const alternatives = alternatePaths(path);
    return [
      `<link rel="canonical" href="${origin}${publicPath}"/>`,
      `<link rel="alternate" hreflang="zh-CN" href="${origin}${alternatives.zh}"/>`,
      `<link rel="alternate" hreflang="en" href="${origin}${alternatives.en}"/>`,
      `<link rel="alternate" hreflang="x-default" href="${origin}${alternatives.zh}"/>`,
    ].join("");
  }

  async function renderPage({
    publicPath,
    routePath,
    language,
    canonicalPath = publicPath,
    tool,
    noindex = false,
  }: {
    publicPath: string;
    routePath: string;
    language: Language;
    canonicalPath?: string;
    tool?: ToolDefinition;
    noindex?: boolean;
  }) {
    await i18n.changeLanguage(language);
    const Page = await loadPage(publicPath);
    const meta = pageMetadata({
      language,
      tool,
      isHome: routePath === "/tools",
    });
    let html = template
      .replace('<div id="root">', '<div id="root" inert>')
      .replace(
        /<html lang="[^"]*">/,
        `<html lang="${language === "zh" ? "zh-CN" : "en"}">`,
      )
      .replace(
        "<!--app-html-->",
        renderToString(createElement(App, { path: publicPath, Page })),
      )
      .replace(/<title>.*?<\/title>/, `<title>${meta.title}</title>`)
      .replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
        `<meta name="description" content="${meta.description}"/>`,
      );

    html = html.replace("</head>", `${routeAssets(publicPath)}</head>`);
    if (noindex || !origin) {
      html = html.replace(
        "</head>",
        '<meta name="robots" content="noindex"/></head>',
      );
    } else if (origin) {
      html = html.replace(
        "</head>",
        `${seoLinks(routePath, canonicalPath)}</head>`,
      );
    }

    const dest =
      publicPath === "/"
        ? "dist/index.html"
        : publicPath === "/404"
          ? "dist/404.html"
          : `dist${publicPath}/index.html`;
    await mkdir(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
    await writeFile(dest, html);
  }

  for (const language of ["zh", "en"] as const) {
    for (const route of canonicalRoutes) {
      const publicPath = localizedPath(route.path, language);
      await renderPage({
        publicPath,
        routePath: route.path,
        language,
        tool: route.tool,
      });
    }
  }

  await renderPage({
    publicPath: "/",
    routePath: "/tools",
    language: "zh",
    canonicalPath: "/tools",
  });
  await renderPage({
    publicPath: "/en",
    routePath: "/tools",
    language: "en",
    canonicalPath: "/en/tools",
  });
  await renderPage({
    publicPath: "/404",
    routePath: "/404",
    language: "zh",
    noindex: true,
  });

  await writeFile(
    "dist/robots.txt",
    origin
      ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
      : "User-agent: *\nDisallow: /\n",
  );

  if (origin) {
    const urls = canonicalRoutes.flatMap((route) =>
      (["zh", "en"] as const).map((language) => {
        const loc = localizedPath(route.path, language);
        const alternatives = alternatePaths(route.path);
        return `<url><loc>${origin}${loc}</loc><xhtml:link rel="alternate" hreflang="zh-CN" href="${origin}${alternatives.zh}"/><xhtml:link rel="alternate" hreflang="en" href="${origin}${alternatives.en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${origin}${alternatives.zh}"/></url>`;
      }),
    );
    await writeFile(
      "dist/sitemap.xml",
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`,
    );
  } else {
    await rm("dist/sitemap.xml", { force: true });
  }

  console.log(
    `Pre-rendered ${canonicalRoutes.length * 2 + 3} pages. ${origin ? `Bilingual canonical, hreflang and sitemap enabled for ${origin}.` : "Preview build: robots and page metadata disable indexing."}`,
  );
} finally {
  await server.close();
}
