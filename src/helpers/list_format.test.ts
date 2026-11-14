import { describe, expect, it } from "vitest";
import { formatList } from "./list_format";

describe("formatList", () => {
  it("joins an and list the locale's way", () => {
    expect(formatList(["A", "B", "C"], "en")).toBe("A, B, and C");
    expect(formatList(["A", "B", "C"], "de")).toBe("A, B und C");
  });

  it("joins an or list the locale's way", () => {
    expect(formatList(["A", "B"], "en", "disjunction")).toBe("A or B");
    expect(formatList(["A", "B"], "de", "disjunction")).toBe("A oder B");
  });

  it("returns a single item as it is", () => {
    expect(formatList(["A"], "en", "disjunction")).toBe("A");
  });

  it("falls back to a comma list for a locale Intl does not accept", () => {
    expect(formatList(["A", "B"], "not a locale!")).toBe("A, B");
  });
});
