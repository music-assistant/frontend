import { AudioLines } from "@lucide/vue";
import { describe, expect, it } from "vitest";
import {
  getBrowseFolderIcon,
  LIVE_SOURCES_BROWSE_SCHEME,
} from "./browse_folder_icon";

describe("getBrowseFolderIcon", () => {
  it("gives the live sources folder its own icon", () => {
    expect(getBrowseFolderIcon(`${LIVE_SOURCES_BROWSE_SCHEME}://`)).toBe(
      AudioLines,
    );
  });

  it("has none for a folder of an ordinary provider", () => {
    expect(getBrowseFolderIcon("filesystem_local--abc://Rock")).toBeUndefined();
  });

  it("has none for a path without a scheme", () => {
    expect(getBrowseFolderIcon("root")).toBeUndefined();
    expect(getBrowseFolderIcon(undefined)).toBeUndefined();
  });
});
