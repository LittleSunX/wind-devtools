import site from "../site.config.json";

export function buildOrigin(
  env: Record<string, string | undefined>,
  { production = false, preview = false } = {},
): string | undefined {
  if (preview || ["preview", "development"].includes(env.VERCEL_ENV ?? ""))
    return undefined;
  const raw = env.SITE_URL || (production ? site.origin : undefined);
  if (!raw) return undefined;
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("SITE_URL must be an HTTP(S) origin");
  return url.origin;
}
