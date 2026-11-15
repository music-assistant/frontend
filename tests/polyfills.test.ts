import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { installPolyfills } from "@/polyfills";
import { afterEach, describe, expect, it } from "vitest";

const FIRST_IMPORT = /^import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']/m;

describe("polyfills", () => {
  const originalHasOwn = Object.hasOwn;

  afterEach(() => {
    Object.defineProperty(Object, "hasOwn", {
      configurable: true,
      value: originalHasOwn,
      writable: true,
    });
  });

  it("defines Object.hasOwn where the runtime lacks it", () => {
    Reflect.deleteProperty(Object, "hasOwn");

    installPolyfills();

    expect(Object.hasOwn({ a: 1 }, "a")).toBe(true);
    expect(Object.hasOwn({ a: 1 }, "toString")).toBe(false);
  });

  // Imports run before main.ts's own body, and a dependency may call these
  // while it loads (Cast receivers on Chrome 92 lack Object.hasOwn).
  it("is the first module main.ts imports", () => {
    const source = readFileSync(resolve(__dirname, "../src/main.ts"), "utf8");
    expect(source.match(FIRST_IMPORT)?.[1]).toBe("@/polyfills");
  });
});
