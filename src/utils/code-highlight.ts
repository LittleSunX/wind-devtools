import Prism from "prismjs";
import { validateCode, type Segment } from "./code-image";

type GrammarLoader = {
  dependencies?: string[];
  load?: () => Promise<unknown>;
};

// Prism's base package supplies markup, CSS, C-like and JavaScript grammars.
// Explicit imports let Vite split the remaining grammars into optional chunks.
const grammars: Record<string, GrammarLoader> = {
  markup: {},
  css: {},
  clike: {},
  javascript: {},
  typescript: {
    dependencies: ["javascript"],
    load: () => import("prismjs/components/prism-typescript"),
  },
  jsx: {
    dependencies: ["markup", "javascript"],
    load: () => import("prismjs/components/prism-jsx"),
  },
  tsx: {
    dependencies: ["jsx", "typescript"],
    load: () => import("prismjs/components/prism-tsx"),
  },
  java: {
    dependencies: ["clike"],
    load: () => import("prismjs/components/prism-java"),
  },
  python: { load: () => import("prismjs/components/prism-python") },
  sql: { load: () => import("prismjs/components/prism-sql") },
  json: { load: () => import("prismjs/components/prism-json") },
  go: {
    dependencies: ["clike"],
    load: () => import("prismjs/components/prism-go"),
  },
  rust: { load: () => import("prismjs/components/prism-rust") },
  c: {
    dependencies: ["clike"],
    load: () => import("prismjs/components/prism-c"),
  },
  cpp: {
    dependencies: ["c"],
    load: () => import("prismjs/components/prism-cpp"),
  },
  csharp: {
    dependencies: ["clike"],
    load: () => import("prismjs/components/prism-csharp"),
  },
  "markup-templating": {
    dependencies: ["markup"],
    load: () => import("prismjs/components/prism-markup-templating"),
  },
  php: {
    dependencies: ["markup-templating"],
    load: () => import("prismjs/components/prism-php"),
  },
  ruby: {
    dependencies: ["clike"],
    load: () => import("prismjs/components/prism-ruby"),
  },
  bash: { load: () => import("prismjs/components/prism-bash") },
  powershell: { load: () => import("prismjs/components/prism-powershell") },
  yaml: { load: () => import("prismjs/components/prism-yaml") },
  toml: { load: () => import("prismjs/components/prism-toml") },
  docker: { load: () => import("prismjs/components/prism-docker") },
  markdown: {
    dependencies: ["markup"],
    load: () => import("prismjs/components/prism-markdown"),
  },
  kotlin: {
    dependencies: ["clike"],
    load: () => import("prismjs/components/prism-kotlin"),
  },
  swift: { load: () => import("prismjs/components/prism-swift") },
};

const grammarLoads = new Map<string, Promise<void>>();

function loadGrammar(language: string): Promise<void> {
  const existing = grammarLoads.get(language);
  if (existing) return existing;
  const grammar = grammars[language];
  if (!grammar) return Promise.reject(new Error("暂不支持该语言。"));
  const loading = (async () => {
    for (const dependency of grammar.dependencies ?? [])
      await loadGrammar(dependency);
    await grammar.load?.();
  })().catch((error) => {
    grammarLoads.delete(language);
    throw error;
  });
  grammarLoads.set(language, loading);
  return loading;
}

export async function highlightCode(
  code: string,
  language: string,
): Promise<Segment[]> {
  validateCode(code);
  if (language === "plain") return [{ text: code, type: "" }];
  const grammarId =
    language === "vue" || language === "xml" ? "markup" : language;
  await loadGrammar(grammarId);
  const grammar = Prism.languages[grammarId];
  if (!grammar) throw new Error("暂不支持该语言。");
  const result: Segment[] = [];
  function flatten(
    value: string | Prism.Token | (string | Prism.Token)[],
    type = "",
  ) {
    if (typeof value === "string") result.push({ text: value, type });
    else if (Array.isArray(value)) value.forEach((v) => flatten(v, type));
    else flatten(value.content, value.type);
  }
  flatten(Prism.tokenize(code, grammar));
  return result;
}
