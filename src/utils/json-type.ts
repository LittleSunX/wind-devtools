import { jsonTool } from "./json";
import type { JsonTypeOptions } from "./shared";

type JavaNumberType = "Long" | "BigInteger" | "Double" | "BigDecimal";

type Shape =
  | { kind: "null" | "boolean" | "string" }
  | { kind: "number"; javaType: JavaNumberType; doubleSafe: boolean }
  | { kind: "array"; element?: Shape }
  | {
      kind: "object";
      count: number;
      fields: Map<string, { shape: Shape; count: number }>;
    }
  | { kind: "union"; variants: Shape[] };

function decimalValue(token: string) {
  const [, sign, integer, fraction = "", exponent = "0"] =
    /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token)!;
  const digits = (integer + fraction).replace(/^0+/, "");
  if (!digits) return "0";
  const significant = digits.replace(/0+$/, "");
  return `${sign}${significant}e${Number(exponent) - fraction.length + digits.length - significant.length}`;
}

function numberShape(token: string): Extract<Shape, { kind: "number" }> {
  const value = Number(token);
  // Compare exact decimal values after normalizing exponent notation and zeros.
  // A Double is sufficient only when conversion preserves the original value.
  const doubleSafe =
    Number.isFinite(value) &&
    decimalValue(token) === decimalValue(String(value));
  let javaType: JavaNumberType;
  if (/^-?\d+$/.test(token)) {
    const digits = token.replace(/^-/, "");
    const limit = token.startsWith("-")
      ? "9223372036854775808"
      : "9223372036854775807";
    javaType =
      digits.length < limit.length ||
      (digits.length === limit.length && digits <= limit)
        ? "Long"
        : "BigInteger";
  } else javaType = doubleSafe ? "Double" : "BigDecimal";
  return { kind: "number", javaType, doubleSafe };
}

function parseShape(input: string): Shape {
  // Infer structure from validated tokens so Java numeric type selection keeps
  // precision that JSON.parse would discard.
  jsonTool(input, { action: "validate" });
  const tokens = input.match(/"(?:\\.|[^"\\])*"|[^\s{}[\],:]+|[{}[\],:]/g)!;
  let index = 0;
  function read(): Shape {
    const token = tokens[index++];
    if (token === "{") {
      const fields = new Map<string, { shape: Shape; count: number }>();
      while (tokens[index] !== "}") {
        const key = JSON.parse(tokens[index++]) as string;
        index++; // colon
        fields.set(key, { shape: read(), count: 1 });
        if (tokens[index] === ",") index++;
      }
      index++;
      return { kind: "object", fields, count: 1 };
    }
    if (token === "[") {
      let element: Shape | undefined;
      while (tokens[index] !== "]") {
        const item = read();
        element = element ? merge(element, item) : item;
        if (tokens[index] === ",") index++;
      }
      index++;
      return { kind: "array", element };
    }
    if (token === "null") return { kind: "null" };
    if (token === "true" || token === "false") return { kind: "boolean" };
    if (token.startsWith('"')) return { kind: "string" };
    return numberShape(token);
  }
  return read();
}

// Shapes are owned by this inference pass; merge consumes its left accumulator.
function merge(left: Shape, right: Shape): Shape {
  if (left.kind === "union" || right.kind === "union") {
    const variants = [
      ...(left.kind === "union" ? left.variants : [left]),
      ...(right.kind === "union" ? right.variants : [right]),
    ];
    const merged: Shape[] = [];
    for (const variant of variants) {
      const index = merged.findIndex((item) => item.kind === variant.kind);
      if (index < 0) merged.push(variant);
      else merged[index] = merge(merged[index], variant);
    }
    return merged.length === 1
      ? merged[0]
      : { kind: "union", variants: merged };
  }
  if (left.kind !== right.kind)
    return { kind: "union", variants: [left, right] };
  if (left.kind === "number" && right.kind === "number") {
    const types = [left.javaType, right.javaType];
    const doubleSafe = left.doubleSafe && right.doubleSafe;
    const javaType = types.includes("BigDecimal")
      ? "BigDecimal"
      : types.includes("Double")
        ? doubleSafe && !types.includes("BigInteger")
          ? "Double"
          : "BigDecimal"
        : types.includes("BigInteger")
          ? "BigInteger"
          : "Long";
    return { kind: "number", javaType, doubleSafe };
  }
  if (left.kind === "array" && right.kind === "array")
    return {
      kind: "array",
      element:
        left.element && right.element
          ? merge(left.element, right.element)
          : (left.element ?? right.element),
    };
  if (left.kind === "object" && right.kind === "object") {
    const fields = left.fields;
    for (const [key, field] of right.fields) {
      const previous = fields.get(key);
      fields.set(
        key,
        previous
          ? {
              shape: merge(previous.shape, field.shape),
              count: previous.count + field.count,
            }
          : field,
      );
    }
    return { kind: "object", count: left.count + right.count, fields };
  }
  return left;
}

function identifier(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_$]/g, "_");
  return /^[A-Za-z_$]/.test(cleaned) && cleaned !== "_"
    ? cleaned
    : `_${cleaned === "_" ? "value" : cleaned}`;
}
function titleCase(value: string) {
  const name = identifier(value || "Root");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Paths, rather than display names, identify nested types. Similar property names
// can sanitize to the same identifier without overwriting each other's classes.
class Names {
  private byPath = new Map<string, string>();
  private used = new Set<string>();
  javaType(name: string) {
    if (name === "BigInteger" || name === "BigDecimal")
      return `java.math.${name}`;
    return this.byPath.get("$root") === name
      ? `${name === "List" ? "java.util" : "java.lang"}.${name}`
      : name;
  }
  get(path: string, requested: string) {
    const existing = this.byPath.get(path);
    if (existing) return existing;
    const base = titleCase(requested);
    let name = base;
    for (let suffix = 2; this.used.has(name); suffix++)
      name = `${base}${suffix}`;
    this.used.add(name);
    this.byPath.set(path, name);
    return name;
  }
}

function childPath(path: string, field: string) {
  return `${path}/${JSON.stringify(field)}`;
}
function typeName(parent: string, field: string) {
  return `${parent}${titleCase(field)}`;
}

function typescript(
  shape: Shape,
  path: string,
  name: string,
  names: Names,
  defs: Map<string, string>,
): string {
  switch (shape.kind) {
    case "null":
    case "boolean":
    case "number":
    case "string":
      return shape.kind;
    case "array": {
      if (!shape.element) return "unknown[]";
      const member = typescript(
        shape.element,
        `${path}/element`,
        name,
        names,
        defs,
      );
      return `${shape.element.kind === "union" ? `(${member})` : member}[]`;
    }
    case "union": {
      const members = shape.variants.map((item) =>
        typescript(item, path, name, names, defs),
      );
      return [...new Set(members)].join(" | ");
    }
    case "object": {
      const id = names.get(path, name);
      const fields = [...shape.fields].map(([key, field]) => {
        const value = typescript(
          field.shape,
          childPath(path, key),
          typeName(id, key),
          names,
          defs,
        );
        return `  ${JSON.stringify(key)}${field.count < shape.count ? "?" : ""}: ${value};`;
      });
      defs.set(id, `export interface ${id} {\n${fields.join("\n")}\n}`);
      return id;
    }
  }
}

const javaKeywords = new Set(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null _ record sealed permits yield var".split(
    " ",
  ),
);
function javaField(key: string, used: Set<string>) {
  const base = identifier(key);
  let name = javaKeywords.has(base) ? `${base}_` : base;
  for (let suffix = 2; used.has(name); suffix++) name = `${base}_${suffix}`;
  used.add(name);
  return name;
}
function java(
  shape: Shape,
  path: string,
  name: string,
  names: Names,
  defs: Map<string, string>,
): string {
  switch (shape.kind) {
    case "null":
      return names.javaType("Object");
    case "boolean":
      return names.javaType("Boolean");
    case "number":
      return names.javaType(shape.javaType);
    case "string":
      return names.javaType("String");
    case "array":
      return `${names.javaType("List")}<${shape.element ? java(shape.element, `${path}/element`, name, names, defs) : names.javaType("Object")}>`;
    case "union": {
      const meaningful = shape.variants.filter((item) => item.kind !== "null");
      return meaningful.length === 1
        ? java(meaningful[0], path, name, names, defs)
        : names.javaType("Object");
    }
    case "object": {
      const id = names.get(path, name);
      const used = new Set<string>();
      const fields = [...shape.fields].map(([key, field]) => {
        const value = java(
          field.shape,
          childPath(path, key),
          typeName(id, key),
          names,
          defs,
        );
        return `    private ${value} ${javaField(key, used)};`;
      });
      defs.set(id, `class ${id} {\n${fields.join("\n")}\n}`);
      return id;
    }
  }
}

export function jsonTypeTool(input: string, options: JsonTypeOptions = {}) {
  const shape = parseShape(input);
  const rootName = titleCase(options.rootName || "Root");
  const itemName = shape.kind === "array" ? `${rootName}Item` : rootName;
  if (options.target === "java") {
    const names = new Names(),
      defs = new Map<string, string>();
    names.get("$root", rootName);
    const rootType = java(
      shape,
      shape.kind === "array" ? "$root/items" : "$root",
      itemName,
      names,
      defs,
    );
    if (shape.kind === "object")
      defs.set(
        rootName,
        defs
          .get(rootName)!
          .replace(`class ${rootName}`, `public class ${rootName}`),
      );
    else
      defs.set(
        rootName,
        `public class ${rootName} {\n    private ${rootType} value;\n}`,
      );
    const root = defs.get(rootName)!;
    return `${rootName === "List" ? "" : "import java.util.List;\n\n"}${[root, ...[...defs].filter(([name]) => name !== rootName).map(([, body]) => body)].join("\n\n")}`;
  }
  const names = new Names(),
    defs = new Map<string, string>();
  names.get("$root", rootName);
  const rootType = typescript(
    shape,
    shape.kind === "array" ? "$root/items" : "$root",
    itemName,
    names,
    defs,
  );
  if (shape.kind === "object") defs.set(rootName, defs.get(rootName)!);
  const root =
    shape.kind === "object"
      ? defs.get(rootName)!
      : `export type ${rootName} = ${rootType};`;
  return [
    root,
    ...[...defs].filter(([name]) => name !== rootName).map(([, body]) => body),
  ].join("\n\n");
}
