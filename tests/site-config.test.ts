import { describe, expect, it } from "vitest";
import { buildOrigin } from "../scripts/site-config";

describe("build indexing configuration", () => {
  it("keeps direct pre-render calls without production mode private and uses the deployed origin in production", () => {
    expect(buildOrigin({})).toBeUndefined();
    expect(buildOrigin({}, { production: true })).toBe(
      "https://wind-tools.ccwu.cc",
    );
    expect(
      buildOrigin(
        { SITE_URL: "https://custom.example/path" },
        { production: true },
      ),
    ).toBe("https://custom.example");
  });
  it("never indexes explicit or Vercel previews even with inherited production configuration", () => {
    const env = { SITE_URL: "https://custom.example" };
    expect(
      buildOrigin(env, { production: true, preview: true }),
    ).toBeUndefined();
    for (const VERCEL_ENV of ["preview", "development"])
      expect(
        buildOrigin({ ...env, VERCEL_ENV }, { production: true }),
      ).toBeUndefined();
  });
  it("rejects non-web origins", () => {
    expect(() => buildOrigin({ SITE_URL: "javascript:alert(1)" })).toThrow(
      "HTTP(S)",
    );
  });
});
