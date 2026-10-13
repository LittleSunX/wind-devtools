import type { CodecOptions } from "./shared";

function encodeBase64Utf8(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Utf8(input: string) {
  const normalized = input.trim().replace(/\s+/g, "");
  if (!normalized) throw new Error("请输入 Base64 内容。");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1)
    throw new Error("Base64 格式无效。");
  try {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("Base64 解码失败，内容可能不是有效的 UTF-8 文本。");
  }
}

export function codecTool(input: string, options: CodecOptions) {
  const codec = options.codec === "url" ? "url" : "base64";
  const direction = options.codecDirection === "decode" ? "decode" : "encode";
  if (codec === "url") {
    try {
      return direction === "encode"
        ? encodeURIComponent(input)
        : decodeURIComponent(input);
    } catch {
      throw new Error("URL 解码失败，请检查百分号编码是否完整。");
    }
  }
  return direction === "encode"
    ? encodeBase64Utf8(input)
    : decodeBase64Utf8(input);
}
