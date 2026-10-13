import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
const initialModules = new Set();
function visitInitial(key) {
  if (initialModules.has(key)) return;
  initialModules.add(key);
  for (const dependency of manifest[key]?.imports ?? [])
    visitInitial(dependency);
}
assert.ok(
  manifest["index.html"]?.isEntry,
  "Vite manifest must contain the app entry",
);
visitInitial("index.html");
for (const route of ["ToolDirectory", "TextToolPage", "CodeImage", "DiffTool"])
  assert.ok(
    !initialModules.has(`src/components/${route}.tsx`),
    `${route} must remain a route chunk`,
  );
const canvasCss = manifest["src/components/CodeImage.tsx"].css ?? [];
assert.ok(canvasCss.length, "Canvas CSS must belong to its route chunk");
const homeHtml = await readFile("dist/tools/index.html", "utf8");
const canvasHtml = await readFile("dist/tools/code-image/index.html", "utf8");
for (const css of canvasCss) {
  assert.ok(
    canvasHtml.includes(`href="/${css}"`),
    "Pre-rendered canvas must load its CSS before hydration",
  );
  assert.ok(
    !homeHtml.includes(`href="/${css}"`),
    "Home must not load canvas CSS",
  );
}
const toolIds = [
  "json",
  "timestamp",
  "jwt",
  "sql",
  "cron",
  "code-image",
  "diff",
  "codec",
  "json-type",
  "text",
];

for (const tool of toolIds) {
  for (const [prefix, lang] of [
    ["", "zh-CN"],
    ["/en", "en"],
  ]) {
    const html = await readFile(
      `dist${prefix}/tools/${tool}/index.html`,
      "utf8",
    );
    assert.ok(html.includes("<h1>"));
    assert.ok(!html.includes("<!--app-html-->"));
    assert.ok(
      html.includes('<div id="root" inert>'),
      "Pre-rendered UI waits for hydration before accepting input",
    );
    assert.ok(html.includes('name="description"'));
    assert.ok(html.includes(`<html lang="${lang}">`));
    if (lang === "en")
      assert.ok(
        !/<title>[^<]*[\p{Script=Han}][^<]*<\/title>/u.test(html),
        `English title contains Chinese: ${tool}`,
      );
  }
}

const fixture = await mkdtemp(path.join(tmpdir(), "wind-seo-"));
try {
  await mkdir(path.join(fixture, "dist"));
  await writeFile(
    path.join(fixture, "dist/index.html"),
    await readFile("index.html"),
  );
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/tsx/dist/cli.mjs"),
      "--tsconfig",
      path.join(root, "tsconfig.json"),
      path.join(root, "scripts/prerender.ts"),
    ],
    {
      cwd: fixture,
      env: {
        ...process.env,
        SITE_URL: "https://wind-devtools.test",
        VERCEL_ENV: "production",
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const zh = await readFile(
    path.join(fixture, "dist/tools/json/index.html"),
    "utf8",
  );
  const en = await readFile(
    path.join(fixture, "dist/en/tools/json/index.html"),
    "utf8",
  );
  assert.ok(
    zh.includes('rel="canonical" href="https://wind-devtools.test/tools/json"'),
  );
  assert.ok(
    en.includes(
      'rel="canonical" href="https://wind-devtools.test/en/tools/json"',
    ),
  );
  for (const html of [zh, en]) {
    assert.ok(
      html.includes(
        'hreflang="zh-CN" href="https://wind-devtools.test/tools/json"',
      ),
    );
    assert.ok(
      html.includes(
        'hreflang="en" href="https://wind-devtools.test/en/tools/json"',
      ),
    );
    assert.ok(
      html.includes(
        'hreflang="x-default" href="https://wind-devtools.test/tools/json"',
      ),
    );
  }
  assert.ok(en.includes("<title>JSON Formatter - Free Online Developer Tool"));
  assert.ok(en.includes('<html lang="en">'));

  const rootAlias = await readFile(
    path.join(fixture, "dist/index.html"),
    "utf8",
  );
  const enAlias = await readFile(
    path.join(fixture, "dist/en/index.html"),
    "utf8",
  );
  assert.ok(
    rootAlias.includes(
      'rel="canonical" href="https://wind-devtools.test/tools"',
    ),
  );
  assert.ok(
    enAlias.includes(
      'rel="canonical" href="https://wind-devtools.test/en/tools"',
    ),
  );

  const sitemap = await readFile(
    path.join(fixture, "dist/sitemap.xml"),
    "utf8",
  );
  assert.equal((sitemap.match(/<url>/g) || []).length, 22);
  assert.ok(sitemap.includes("xmlns:xhtml="));
  assert.ok(
    sitemap.includes("<loc>https://wind-devtools.test/en/tools/json</loc>"),
  );
  assert.ok(
    (await readFile(path.join(fixture, "dist/robots.txt"), "utf8")).includes(
      "Sitemap: https://wind-devtools.test/sitemap.xml",
    ),
  );

  const page404 = await readFile(path.join(fixture, "dist/404.html"), "utf8");
  assert.ok(page404.includes('name="robots" content="noindex"'));
  assert.ok(!page404.includes('rel="canonical"'));

  // Rebuild as a preview to ensure previous production SEO files cannot remain.
  await rm(path.join(fixture, "dist"), { recursive: true });
  await mkdir(path.join(fixture, "dist"));
  await writeFile(
    path.join(fixture, "dist/index.html"),
    await readFile("index.html"),
  );
  const preview = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/tsx/dist/cli.mjs"),
      "--tsconfig",
      path.join(root, "tsconfig.json"),
      path.join(root, "scripts/prerender.ts"),
    ],
    {
      cwd: fixture,
      env: {
        ...process.env,
        SITE_URL: "https://wind-devtools.test",
        VERCEL_ENV: "preview",
      },
      encoding: "utf8",
    },
  );
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  assert.ok(
    (await readFile(path.join(fixture, "dist/robots.txt"), "utf8")).includes(
      "Disallow: /",
    ),
  );
  await assert.rejects(access(path.join(fixture, "dist/sitemap.xml")));
  assert.ok(
    (
      await readFile(path.join(fixture, "dist/tools/index.html"), "utf8")
    ).includes('name="robots" content="noindex"'),
  );

  console.log(
    "Build checks passed: bilingual static pages, canonical/hreflang, sitemap, preview robots and 404 metadata.",
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}
