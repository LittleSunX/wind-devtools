import { downloadFilename } from "./download-filename";

export type Segment = { text: string; type: string };
export type ImageOptions = {
  theme: string;
  background: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  padding: number;
  scale: number;
  lineNumbers: boolean;
  windowBar: boolean;
  title: string;
  widthMode: "auto" | "fixed";
  width: number;
  wrap: boolean;
  windowRadius: number;
  shadow: "none" | "soft" | "strong";
  windowStyle: "mac" | "minimal" | "title" | "none";
  codePadding: number;
  startLine: number;
  highlightLines: string;
  aspectRatio: "free" | "1:1" | "4:3" | "16:9" | "1.91:1";
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
};
export const canvasFonts = [
  {
    id: "jetbrains",
    name: "JetBrains Mono",
    family: "Wind JetBrains Mono",
    file: "JetBrainsMono-Regular.woff2",
  },
  {
    id: "source",
    name: "Source Code Pro",
    family: "Wind Source Code Pro",
    file: "SourceCodePro-Regular.woff2",
  },
  {
    id: "system",
    name: "系统等宽",
    family: 'Consolas, "SFMono-Regular", "Liberation Mono"',
    file: "",
  },
];
export function canvasFont(
  options: Pick<ImageOptions, "fontFamily" | "fontSize">,
) {
  const face =
    canvasFonts.find((font) => font.id === options.fontFamily) ??
    canvasFonts[0];
  return `${options.fontSize}px ${face.file ? `"${face.family}"` : face.family}, "Microsoft YaHei", "PingFang SC", monospace`;
}
export const sampleCode = `// 让代码，也有好看的表达。
interface Developer {
  name: string;
  tools: string[];
}

const wind: Developer = {
  name: "Wind",
  tools: ["Build", "Create", "Share"],
};

console.log("Hello, developer!", wind);`;
export const languageGroups = [
  {
    label: "前端",
    items: [
      ["typescript", "TypeScript"],
      ["javascript", "JavaScript"],
      ["jsx", "JSX"],
      ["tsx", "TSX"],
      ["markup", "HTML"],
      ["css", "CSS"],
      ["vue", "Vue"],
    ],
  },
  {
    label: "后端与应用",
    items: [
      ["java", "Java"],
      ["python", "Python"],
      ["go", "Go"],
      ["rust", "Rust"],
      ["c", "C"],
      ["cpp", "C++"],
      ["csharp", "C#"],
      ["php", "PHP"],
      ["ruby", "Ruby"],
      ["kotlin", "Kotlin"],
      ["swift", "Swift"],
    ],
  },
  {
    label: "脚本与配置",
    items: [
      ["bash", "Bash"],
      ["powershell", "PowerShell"],
      ["json", "JSON"],
      ["yaml", "YAML"],
      ["toml", "TOML"],
      ["xml", "XML"],
      ["docker", "Dockerfile"],
      ["markdown", "Markdown"],
    ],
  },
  {
    label: "其他",
    items: [
      ["sql", "SQL"],
      ["plain", "纯文本"],
    ],
  },
];
export const languages = languageGroups.flatMap((group) => group.items);
export const imagePresets = [
  {
    name: "午夜蓝",
    theme: "night",
    background: "blue",
    padding: 32,
    fontSize: 16,
    fontFamily: "jetbrains",
    lineHeight: 1.65,
    codePadding: 24,
    lineNumbers: true,
    windowStyle: "mac",
    windowRadius: 12,
    shadow: "soft",
    aspectRatio: "free",
  },
  {
    name: "暖日落",
    theme: "graphite",
    background: "sunset",
    padding: 32,
    fontSize: 16,
    fontFamily: "jetbrains",
    lineHeight: 1.65,
    codePadding: 24,
    lineNumbers: true,
    windowStyle: "mac",
    windowRadius: 18,
    shadow: "strong",
    aspectRatio: "free",
  },
  {
    name: "极简白",
    theme: "light",
    background: "slate",
    padding: 32,
    fontSize: 16,
    fontFamily: "source",
    lineHeight: 1.4,
    codePadding: 24,
    lineNumbers: false,
    windowStyle: "mac",
    windowRadius: 8,
    shadow: "soft",
    aspectRatio: "free",
  },
  {
    name: "透明底",
    theme: "graphite",
    background: "transparent",
    padding: 32,
    fontSize: 16,
    fontFamily: "jetbrains",
    lineHeight: 1.65,
    codePadding: 24,
    lineNumbers: true,
    windowStyle: "mac",
    windowRadius: 12,
    shadow: "none",
    aspectRatio: "free",
  },
  {
    name: "静谧松林",
    theme: "forest",
    background: "slate",
    padding: 32,
    fontSize: 16,
    fontFamily: "source",
    lineHeight: 1.65,
    codePadding: 28,
    lineNumbers: true,
    windowStyle: "mac",
    windowRadius: 12,
    shadow: "soft",
    aspectRatio: "free",
  },
  {
    name: "暖纸手记",
    theme: "paper",
    background: "solid",
    padding: 32,
    fontSize: 16,
    fontFamily: "source",
    lineHeight: 1.65,
    codePadding: 28,
    lineNumbers: false,
    windowStyle: "mac",
    windowRadius: 8,
    shadow: "soft",
    aspectRatio: "free",
    color: "#e7dfd1",
  },
] as const;
export const themeChoices = [
  ["night", "午夜蓝"],
  ["graphite", "石墨黑"],
  ["light", "明亮"],
  ["forest", "松林"],
  ["paper", "暖纸"],
];
export const defaults: ImageOptions = {
  theme: "night",
  background: "blue",
  color: "#5269d8",
  fontSize: 16,
  fontFamily: "jetbrains",
  lineHeight: 1.65,
  padding: 32,
  scale: 2,
  lineNumbers: true,
  windowBar: true,
  title: "hello.ts",
  widthMode: "auto",
  width: 800,
  wrap: true,
  windowRadius: 12,
  shadow: "soft",
  windowStyle: "mac",
  codePadding: 24,
  startLine: 1,
  highlightLines: "",
  aspectRatio: "free",
  gradientStart: "#8ea9ef",
  gradientEnd: "#b8a2e6",
  gradientAngle: 135,
};
export function parseHighlightedLines(
  value: string,
  startLine: number,
  lineCount: number,
) {
  const result = new Set<number>();
  const text = value.trim();
  if (!text) return result;
  const lastLine = startLine + Math.max(0, lineCount - 1);
  for (const part of text.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start
      )
        continue;
      for (
        let line = Math.max(start, startLine);
        line <= Math.min(end, lastLine);
        line++
      )
        result.add(line);
      continue;
    }
    if (/^\d+$/.test(token)) {
      const line = Number(token);
      if (line >= startLine && line <= lastLine) result.add(line);
    }
  }
  return result;
}

export function aspectRatioValue(value: ImageOptions["aspectRatio"]) {
  switch (value) {
    case "1:1":
      return "1 / 1";
    case "4:3":
      return "4 / 3";
    case "16:9":
      return "16 / 9";
    case "1.91:1":
      return "1.91 / 1";
    default:
      return undefined;
  }
}

export function validateCode(code: string) {
  if (!code.trim()) throw new Error("请输入代码，或加载示例。");
  if (code.length > 12000)
    throw new Error("代码画布最多支持 12,000 个字符，请拆分代码。");
  if (code.split(/\r\n|\r|\n/).length > 160)
    throw new Error("最多支持 160 行，请拆分代码。");
}
export function splitSegments(segments: Segment[]): Segment[][] {
  const lines: Segment[][] = [[]];
  for (const seg of segments) {
    const parts = seg.text.replace(/\r\n?/g, "\n").split("\n");
    parts.forEach((text, i) => {
      if (i) lines.push([]);
      if (text) lines[lines.length - 1].push({ text, type: seg.type });
    });
  }
  return lines;
}
export const themes: Record<
  string,
  { bg: string; text: string; muted: string; colors: Record<string, string> }
> = {
  night: {
    bg: "#171d2d",
    text: "#d9e3f0",
    muted: "#69768c",
    colors: {
      keyword: "#c3a6ff",
      string: "#a8deb4",
      comment: "#7b879d",
      number: "#f2b77e",
      boolean: "#f2b77e",
      function: "#8bbfff",
      operator: "#8fd4e4",
      punctuation: "#9aaac1",
      "class-name": "#f4d68a",
      property: "#9fcbff",
      tag: "#ec9fad",
    },
  },
  light: {
    bg: "#ffffff",
    text: "#303b50",
    muted: "#8a94a5",
    colors: {
      keyword: "#7948b9",
      string: "#237b52",
      comment: "#738096",
      number: "#ae5b26",
      boolean: "#ae5b26",
      function: "#285cba",
      operator: "#29718b",
      punctuation: "#63728a",
      "class-name": "#966812",
      property: "#285cba",
      tag: "#a83d62",
    },
  },
  forest: {
    bg: "#182b28",
    text: "#deebe3",
    muted: "#92aaa0",
    colors: {
      keyword: "#c5b4eb",
      string: "#b8d9a4",
      comment: "#91aa9c",
      number: "#efbd91",
      boolean: "#efbd91",
      function: "#a4d7cf",
      operator: "#e2cf9d",
      punctuation: "#b0c4ba",
      "class-name": "#e2cf9d",
      property: "#a4d7cf",
      tag: "#deb0bc",
    },
  },
  paper: {
    bg: "#faf6ed",
    text: "#423c35",
    muted: "#857766",
    colors: {
      keyword: "#87528d",
      string: "#526d36",
      comment: "#82766a",
      number: "#a05b2c",
      boolean: "#a05b2c",
      function: "#356979",
      operator: "#8a5940",
      punctuation: "#786b5d",
      "class-name": "#916619",
      property: "#356979",
      tag: "#a34e56",
    },
  },
  graphite: {
    bg: "#202124",
    text: "#e5e5e7",
    muted: "#8c9098",
    colors: {
      keyword: "#e8a5cf",
      string: "#a5d6ac",
      comment: "#92969f",
      number: "#e8bd8e",
      boolean: "#e8bd8e",
      function: "#a8c7fa",
      operator: "#99d8dc",
      punctuation: "#b0b4be",
      "class-name": "#e8cd8d",
      property: "#a8c7fa",
      tag: "#e8a5cf",
    },
  },
};
export function imageFilename(date = new Date(), extension = "png") {
  return downloadFilename("wind-code", extension, date);
}
