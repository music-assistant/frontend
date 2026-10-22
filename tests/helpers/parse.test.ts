import { parseBool } from "@/helpers/parse";
import { describe, expect, it } from "vitest";

describe("parseBool", () => {
  it("parses boolean values correctly", () => {
    expect(parseBool(true)).toBe(true);
    expect(parseBool(false)).toBe(false);
  });

  it("parses string values correctly", () => {
    expect(parseBool("true")).toBe(true);
    expect(parseBool("false")).toBe(false);
    expect(parseBool("TRUE")).toBe(true);
    expect(parseBool("FALSE")).toBe(false);
  });

  it("handles null/undefined", () => {
    expect(parseBool(null)).toBe(false);
    expect(parseBool(undefined)).toBe(false);
  });

  it("handles empty values", () => {
    expect(parseBool("")).toBe(false);
    expect(parseBool("0")).toBe(false);
  });
});
