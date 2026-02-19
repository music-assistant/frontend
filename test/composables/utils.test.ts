import { describe, expect, it } from "vitest";
import { mergeClasses } from "@/composables/utils";

describe("mergeClasses", () => {
  it("merges valid class strings", () => {
    expect(mergeClasses("class1", "class2", "class3")).toBe(
      "class1 class2 class3",
    );
  });

  it("filters out falsy values", () => {
    expect(
      mergeClasses("class1", false, "class2", null, undefined, "class3"),
    ).toBe("class1 class2 class3");
  });

  it("handles empty input", () => {
    expect(mergeClasses()).toBe("");
    expect(mergeClasses(false, null, undefined)).toBe("");
  });

  it("handles single class", () => {
    expect(mergeClasses("single-class")).toBe("single-class");
  });

  it("handles mixed valid and invalid classes", () => {
    expect(mergeClasses("", "valid", false, "another")).toBe("valid another");
  });
});
