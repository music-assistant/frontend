import { describe, expect, it } from "vitest";
import { camelotColor } from "./camelot";

describe("camelotColor", () => {
  it("gives each wheel number its own hue", () => {
    expect(camelotColor("1B")).toBe("hsl(170 75% 62%)");
    expect(camelotColor("4B")).toBe("hsl(80 75% 62%)");
    expect(camelotColor("12B")).toBe("hsl(200 75% 62%)");
  });

  it("shares the hue between the minor and major ring", () => {
    expect(camelotColor("8A")).toBe("hsl(320 55% 62%)");
    expect(camelotColor("8B")).toBe("hsl(320 75% 62%)");
  });

  it("ignores anything that is not a Camelot code", () => {
    expect(camelotColor(undefined)).toBeUndefined();
    expect(camelotColor("13A")).toBeUndefined();
    expect(camelotColor("F# minor")).toBeUndefined();
  });
});
