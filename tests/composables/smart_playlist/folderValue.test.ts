import {
  folderPath,
  folderValue,
} from "@/composables/smart-playlist/useSmartPlaylistRulesForm";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: {
    providers: {
      "filesystem_local--music": { name: "My Music" },
    },
  },
}));

describe("folderValue", () => {
  it("gives every folder its own id and keeps it for the same path", () => {
    // these two paths collide in a 32-bit string hash
    const a = folderValue("filesystem_local--music://Aa");
    const b = folderValue("filesystem_local--music://BB");

    expect(a.id).not.toBe(b.id);
    expect(folderValue("filesystem_local--music://Aa").id).toBe(a.id);
    expect(a.name).toBe("My Music/Aa");
    expect(folderPath(b.id)).toBe("filesystem_local--music://BB");
  });
});
