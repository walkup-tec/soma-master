import { timingSafeEqual } from "node:crypto";

export function timingSafeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
