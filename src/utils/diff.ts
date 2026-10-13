export type DiffKind = "same" | "add" | "remove";
export type DiffLine = {
  kind: DiffKind;
  text: string;
  left?: number;
  right?: number;
  noNewline?: boolean;
};
export const MAX_DIFF_BYTES = 5 * 1024 * 1024;

export type DiffRequest = { requestId: number; left: string; right: string };
export type DiffResponse =
  | { requestId: number; status: "success"; lines: DiffLine[] }
  | { requestId: number; status: "error"; error: string };

export function diffLines(leftText: string, rightText: string): DiffLine[] {
  if (
    leftText.length + rightText.length > MAX_DIFF_BYTES ||
    new TextEncoder().encode(leftText).length +
      new TextEncoder().encode(rightText).length >
      MAX_DIFF_BYTES
  )
    throw new Error("Diff 两侧文本合计最多支持 5 MiB，请拆分后比较。");
  const split = (value: string) => {
    if (!value) return [];
    const normalized = value.replace(/\r\n?/g, "\n");
    const parts = normalized.split("\n");
    const hasNewline = normalized.endsWith("\n");
    if (hasNewline) parts.pop();
    return parts.map((text, index) => ({
      text,
      noNewline: !hasNewline && index === parts.length - 1,
    }));
  };
  const left = split(leftText);
  const right = split(rightText);
  if (left.length > 1200 || right.length > 1200)
    throw new Error("Diff 单侧最多支持 1,200 行，请拆分后比较。");

  const cols = right.length + 1;
  const dp = new Uint16Array((left.length + 1) * cols);
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      const idx = i * cols + j;
      dp[idx] =
        left[i].text === right[j].text &&
        left[i].noNewline === right[j].noNewline
          ? dp[(i + 1) * cols + j + 1] + 1
          : Math.max(dp[(i + 1) * cols + j], dp[i * cols + j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0,
    j = 0,
    leftNo = 1,
    rightNo = 1;
  while (i < left.length && j < right.length) {
    if (
      left[i].text === right[j].text &&
      left[i].noNewline === right[j].noNewline
    ) {
      result.push({
        kind: "same",
        ...left[i],
        left: leftNo++,
        right: rightNo++,
      });
      i++;
      j++;
    } else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) {
      result.push({ kind: "remove", ...left[i++], left: leftNo++ });
    } else {
      result.push({ kind: "add", ...right[j++], right: rightNo++ });
    }
  }
  while (i < left.length)
    result.push({ kind: "remove", ...left[i++], left: leftNo++ });
  while (j < right.length)
    result.push({ kind: "add", ...right[j++], right: rightNo++ });
  return result;
}

export function formatUnifiedDiff(lines: DiffLine[], context = 3) {
  const radius = Math.max(0, Math.floor(context));
  const hunks: { start: number; end: number }[] = [];
  lines.forEach((line, index) => {
    if (line.kind === "same") return;
    const start = Math.max(0, index - radius);
    const end = Math.min(lines.length, index + radius + 1);
    const previous = hunks[hunks.length - 1];
    if (previous && start <= previous.end) previous.end = end;
    else hunks.push({ start, end });
  });
  if (!hunks.length) return "";
  const output = ["--- a/text", "+++ b/text"];
  for (const { start, end } of hunks) {
    const before = lines.slice(0, start);
    const body = lines.slice(start, end);
    const leftBefore = before.filter((line) => line.kind !== "add").length;
    const rightBefore = before.filter((line) => line.kind !== "remove").length;
    const leftCount = body.filter((line) => line.kind !== "add").length;
    const rightCount = body.filter((line) => line.kind !== "remove").length;
    output.push(
      `@@ -${leftBefore + (leftCount ? 1 : 0)},${leftCount} +${rightBefore + (rightCount ? 1 : 0)},${rightCount} @@`,
    );
    for (const line of body) {
      output.push(
        `${line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "}${line.text}`,
      );
      if (line.noNewline) output.push("\\ No newline at end of file");
    }
  }
  return output.join("\n") + "\n";
}
