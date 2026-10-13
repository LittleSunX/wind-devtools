import { i18n, resolveLanguage, errorMessage } from "./i18n";
import {
  checkInput,
  type ToolRequest,
  type ToolResponse,
} from "./utils/shared";
self.onmessage = async (event: MessageEvent<ToolRequest>) => {
  const { id, input, options } = event.data;
  try {
    await i18n.changeLanguage(resolveLanguage(event.data.language ?? null, []));
    checkInput(input, id);
    let result: string;
    switch (id) {
      case "json":
        result = (await import("./utils/json")).jsonTool(input, options);
        break;
      case "timestamp":
        result = (await import("./utils/timestamp")).timestampTool(
          input,
          options,
        );
        break;
      case "jwt":
        result = (await import("./utils/jwt")).jwtTool(input);
        break;
      case "sql":
        result = (await import("./utils/sql")).sqlTool(input, options);
        break;
      case "cron":
        result = (await import("./utils/cron")).cronTool(input, options);
        break;
      case "codec":
        result = (await import("./utils/codec")).codecTool(input, options);
        break;
      case "json-type":
        result = (await import("./utils/json-type")).jsonTypeTool(
          input,
          options,
        );
        break;
      case "text":
        result = (await import("./utils/text")).textTool(input, options);
        break;
      default:
        throw new Error("未知工具。");
    }
    self.postMessage({ status: "success", result } satisfies ToolResponse);
  } catch (error) {
    self.postMessage({
      status: "error",
      error: errorMessage(error),
    } satisfies ToolResponse);
  }
};
