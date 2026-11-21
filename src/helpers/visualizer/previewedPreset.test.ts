import { describe, expect, it } from "vitest";
import { resolveFixedPreset, USE_PREVIEWED_VALUE } from "./previewedPreset";

describe("resolveFixedPreset", () => {
  it("maps the sentinel to the previewed preset, never the sentinel", () => {
    expect(resolveFixedPreset(USE_PREVIEWED_VALUE, "Some preset")).toBe(
      "Some preset",
    );
  });

  it("is empty when the sentinel has nothing previewed", () => {
    expect(resolveFixedPreset(USE_PREVIEWED_VALUE, null)).toBe("");
  });

  it("passes a real preset name through", () => {
    expect(resolveFixedPreset("Other", "Some preset")).toBe("Other");
  });
});
