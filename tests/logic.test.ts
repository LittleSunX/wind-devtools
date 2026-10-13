import { describe, it, expect } from "vitest";
import {
  processTool,
  jsonTool,
  jwtTool,
  timestampTool,
  cronTool,
  normalizeCron,
  MAX_BYTES,
} from "../src/logic";
const jwt = (value: unknown) =>
  `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(value)).toString("base64url")}.`;
describe("JSON data integrity", () => {
  it("preserves integers and exponents", () => {
    const result = jsonTool(
      '{"id":90071992547409931234,"v":1.234567890123456789e+30}',
      {},
    );
    expect(result).toContain("90071992547409931234");
    expect(result).toContain("1.234567890123456789e+30");
  });
  it("rejects nested and escaped duplicate keys", () => {
    expect(() => jsonTool('{"a":{"x":1,"\\u0078":2}}', {})).toThrow("重复键");
  });
  it("accepts repeated keys in separate objects and handles __proto__", () => {
    expect(jsonTool('[{"a":1},{"a":2}]', { action: "minify" })).toBe(
      '[{"a":1},{"a":2}]',
    );
    expect(jsonTool('{"__proto__":1}', { action: "minify" })).toBe(
      '{"__proto__":1}',
    );
  });
  it("rejects invalid JSON", () =>
    expect(() => jsonTool('{"a":}', {})).toThrow());
  it("validates primitives and compresses correctly", () => {
    expect(jsonTool("null", { action: "validate" })).toContain("正确");
    expect(jsonTool('{ "a": 1 }', { action: "minify" })).toBe('{"a":1}');
  });
});
describe("timestamp boundaries", () => {
  it("handles epoch, negatives and explicit units", () => {
    expect(timestampTool("0", {})).toContain("1970-01-01T00:00:00.000Z");
    expect(timestampTool("-1", { unit: "s" })).toContain(
      "1969-12-31T23:59:59.000Z",
    );
    expect(timestampTool("1789344000000", {})).toContain("1789344000");
  });
  it("rejects invalid calendar dates and rollover", () => {
    for (const d of [
      "2026-02-29 00:00:00",
      "2026-04-31 00:00:00",
      "2026-01-01 24:00:00",
    ])
      expect(() => timestampTool(d, { direction: "date" })).toThrow("日期无效");
  });
  it("accepts leap years and converts date to epoch", () => {
    expect(
      timestampTool("2024-02-29 00:00:00", { direction: "date" }),
    ).toContain("2024-02-29T");
    expect(
      timestampTool("1970-01-01 00:00:00", { direction: "date" }),
    ).toContain("毫秒级时间戳\n0");
  });
  it("rejects nonnumeric and oversized values", () => {
    expect(() => timestampTool("foo", {})).toThrow();
    expect(() => timestampTool("999999999999999999999", {})).toThrow();
    expect(() => timestampTool("8640000000000001", {})).toThrow();
  });
});
describe("JWT unverified decoding", () => {
  it("decodes UTF-8 and missing expiry safely", () => {
    const text = jwtTool(jwt({ name: "风" }));
    expect(text).toContain("风");
    expect(text).toContain("未提供过期时间");
    expect(text).toContain("签名未经验证");
  });
  it("checks expiry and not-before against fixed clock", () => {
    expect(jwtTool(jwt({ exp: 100, nbf: 300 }), 200000)).toContain("已过期");
    expect(jwtTool(jwt({ exp: 100, nbf: 300 }), 200000)).toContain("尚未生效");
  });
  it("rejects malformed and encrypted tokens", () => {
    expect(() => jwtTool("a.b.c.d.e")).toThrow("JWE");
    expect(() => jwtTool("**.aa.x")).toThrow();
    expect(() => jwtTool(jwt([]))).toThrow();
  });
  it("reports invalid time fields", () =>
    expect(jwtTool(jwt({ exp: "123", iat: null }))).toContain("时间字段无效"));
});
describe("SQL semantics", () => {
  it.each(["mysql", "postgresql", "plsql"] as const)(
    "formats %s without changing string literals",
    (dialect) => {
      expect(
        processTool("sql", "select 'select  a  b' as label from users;", {
          dialect,
        }),
      ).toContain("'select  a  b'");
    },
  );
  it("keeps line comments on separate lines", () => {
    const sql = processTool("sql", "select id -- important\nfrom users", {});
    expect(sql).toMatch(/-- important\n/);
    expect(sql).toContain("FROM");
  });
});
describe("Cron dialects", () => {
  const now = new Date("2026-09-16T00:00:00Z");
  it("maps Quartz Monday to Linux Monday", () => {
    expect(normalizeCron("0 0 0 ? * 2", "quartz")).toBe("0 0 0 * * 1");
    expect(cronTool("0 0 0 ? * 2", {}, now)).toContain(
      "2026-09-21T00:00:00.000Z",
    );
  });
  it("handles Quartz weekday steps before mapping", () => {
    expect(normalizeCron("0 0 0 ? * 2/2", "quartz")).toBe("0 0 0 * * 1,3,5");
    expect(normalizeCron("0 0 0 ? * 1-7/2", "quartz")).toBe(
      "0 0 0 * * 0,2,4,6",
    );
  });
  it("distinguishes Linux OR matching from Quartz day restrictions", () => {
    expect(cronTool("0 0 1 * 1", { mode: "linux" }, now)).toContain(
      "2026-09-21T00:00:00.000Z",
    );
    expect(() => normalizeCron("0 0 0 1 * 2", "quartz")).toThrow();
  });
  it("rejects unsupported syntax instead of reinterpreting", () => {
    for (const input of [
      "0 0 0 L * ?",
      "0 0 0 * * ? 2026",
      "0 0 0 * * 0",
      "0 0 0 ? * 0",
      "0 0 0 ? * 7-1",
    ])
      expect(() => normalizeCron(input, "quartz")).toThrow();
    expect(() => normalizeCron("0 0 ? * *", "linux")).toThrow();
  });
  it("returns 5 future occurrences and handles no match", () => {
    expect(cronTool("*/5 * * * *", { mode: "linux" }, now)).toContain(
      "5. 2026-09-16T00:25:00.000Z",
    );
    expect(cronTool("0 0 31 2 *", { mode: "linux" }, now)).toContain("未找到");
  });
});
describe("input guard", () => {
  it("allows meaningful whitespace for codecs and text operations", () => {
    expect(
      processTool("codec", " \n", {
        codec: "base64",
        codecDirection: "encode",
      }),
    ).toBe("IAo=");
    expect(
      processTool("codec", " \n", { codec: "url", codecDirection: "encode" }),
    ).toBe("%20%0A");
    expect(processTool("text", " \n ", { textAction: "remove-empty" })).toBe(
      "",
    );
    expect(processTool("text", " ", { textAction: "trim-lines" })).toBe("");
  });

  it("still rejects truly empty codec/text inputs and oversized whitespace", () => {
    expect(() => processTool("codec", "", {})).toThrow("先输入");
    expect(() => processTool("text", "", {})).toThrow("先输入");
    expect(() => processTool("text", " ".repeat(MAX_BYTES + 1), {})).toThrow(
      "5 MiB",
    );
  });

  it("rejects empty and oversized UTF-8 input", () => {
    expect(() => processTool("json", " ", {})).toThrow("先输入");
    expect(() =>
      processTool("json", "中".repeat(Math.ceil(MAX_BYTES / 3)), {}),
    ).toThrow("5 MiB");
  });
});

describe("JSON token preservation", () => {
  it("preserves escapes, punctuation inside strings, empty objects and negative zero", () => {
    const text =
      '{"escaped":"a\\\"b\\\\c\\n:[]{}", "array":[{},[],null,true,false,-0,1e400], "unicode":"\\u4e2d"}';
    expect(jsonTool(jsonTool(text, {}), { action: "minify" })).toBe(
      jsonTool(text, { action: "minify" }),
    );
    expect(jsonTool(text, {})).toContain("1e400");
    expect(jsonTool(text, {})).toContain("-0");
  });
  it("enforces depth before expensive formatting", () =>
    expect(() => jsonTool("[".repeat(129) + "0" + "]".repeat(129), {})).toThrow(
      "128",
    ));
  it("preserves large integer claims in JWT display", () => {
    const payload = Buffer.from('{"id":90071992547409931234}').toString(
      "base64url",
    );
    expect(jwtTool(`eyJhbGciOiJub25lIn0.${payload}.`)).toContain(
      "90071992547409931234",
    );
  });
});
