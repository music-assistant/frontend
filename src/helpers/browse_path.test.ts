import { describe, expect, it } from "vitest";
import { parentBrowsePath } from "./browse_path";

describe("parentBrowsePath", () => {
  it("goes up one folder", () => {
    expect(parentBrowsePath("fs--abc://Rock/Classic")).toBe("fs--abc://Rock");
  });

  it("goes from a top-level folder to the provider's root", () => {
    expect(parentBrowsePath("fs--abc://Rock")).toBe("fs--abc://");
  });

  it("goes from a provider's root to the browse root", () => {
    expect(parentBrowsePath("fs--abc://")).toBe("root");
  });
});
