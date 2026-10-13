export type JsonOptions = {
  action?: "format" | "minify" | "validate";
  indent?: "2" | "4";
};
export type SqlOptions = {
  dialect?: "mysql" | "postgresql" | "plsql";
  keyword?: "upper" | "lower";
  indent?: "2" | "4";
};
export type TimestampOptions = {
  direction?: "timestamp" | "date";
  unit?: "ms" | "s";
  zone?: "UTC" | "local";
};
export type CronOptions = {
  mode?: "quartz" | "linux";
  zone?: "UTC" | "local";
};
export type CodecOptions = {
  codec?: "base64" | "url";
  codecDirection?: "encode" | "decode";
};
export type JsonTypeOptions = {
  target?: "typescript" | "java";
  rootName?: string;
};
export type TextOptions = {
  textAction?:
    | "dedupe"
    | "sort-asc"
    | "sort-desc"
    | "trim-lines"
    | "remove-empty"
    | "upper"
    | "lower"
    | "prefix"
    | "suffix";
  prefix?: string;
  suffix?: string;
};

export type AppOptions = Required<
  Omit<
    JsonOptions &
      SqlOptions &
      TimestampOptions &
      CronOptions &
      CodecOptions &
      JsonTypeOptions &
      TextOptions,
    "action"
  >
>;

export type ToolOptionsMap = {
  json: JsonOptions;
  sql: SqlOptions;
  timestamp: TimestampOptions;
  cron: CronOptions;
  codec: CodecOptions;
  "json-type": JsonTypeOptions;
  text: TextOptions;
  jwt: Record<string, never>;
};
export type ProcessableToolId = keyof ToolOptionsMap;
export function isProcessableToolId(id: string): id is ProcessableToolId {
  return [
    "json",
    "sql",
    "timestamp",
    "cron",
    "codec",
    "json-type",
    "text",
    "jwt",
  ].includes(id);
}
export type ToolRequest = {
  [K in ProcessableToolId]: {
    id: K;
    input: string;
    options: ToolOptionsMap[K];
    language?: string;
  };
}[ProcessableToolId];
export type ToolResponse =
  { status: "success"; result: string } | { status: "error"; error: Message };

export function createToolRequest(
  id: ProcessableToolId,
  input: string,
  options: AppOptions,
  action: JsonOptions["action"] = "format",
  language?: string,
): ToolRequest {
  const common = { input, language };
  switch (id) {
    case "json":
      return { ...common, id, options: { action, indent: options.indent } };
    case "sql":
      return {
        ...common,
        id,
        options: {
          dialect: options.dialect,
          keyword: options.keyword,
          indent: options.indent,
        },
      };
    case "timestamp":
      return {
        ...common,
        id,
        options: {
          direction: options.direction,
          unit: options.unit,
          zone: options.zone,
        },
      };
    case "cron":
      return {
        ...common,
        id,
        options: { mode: options.mode, zone: options.zone },
      };
    case "codec":
      return {
        ...common,
        id,
        options: {
          codec: options.codec,
          codecDirection: options.codecDirection,
        },
      };
    case "json-type":
      return {
        ...common,
        id,
        options: { target: options.target, rootName: options.rootName },
      };
    case "text":
      return {
        ...common,
        id,
        options: {
          textAction: options.textAction,
          prefix: options.prefix,
          suffix: options.suffix,
        },
      };
    case "jwt":
      return { ...common, id, options: {} };
  }
}
export const MAX_BYTES = 5 * 1024 * 1024;
export function checkInput(input: string, id?: ProcessableToolId) {
  const allowsWhitespace = id === "codec" || id === "text";
  if (!(allowsWhitespace ? input.length : input.trim().length))
    throw new Error("请先输入需要处理的内容。");
  if (new TextEncoder().encode(input).length > MAX_BYTES)
    throw new Error("输入超过 5 MiB，请拆分后再处理。");
}
import type { Message } from "../i18n";
