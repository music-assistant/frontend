import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, setPreference } = vi.hoisted(() => ({
  storeMock: { currentUser: { preferences: {} as Record<string, unknown> } },
  setPreference: vi.fn(),
}));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: setPreference,
}));

import {
  AUDIOBOOK_ROWS,
  AUDIOBOOK_ROWS_PREFERENCE_KEY,
  audiobookRows,
} from "@/components/audiobook/audiobookRows";
import { audiobook } from "../../fixtures/audiobook";

const ids = AUDIOBOOK_ROWS.map((row) => row.id);

describe("audiobookRows", () => {
  beforeEach(() => {
    storeMock.currentUser.preferences = {};
    setPreference.mockReset();
  });

  it("defaults to description, chapters and provider details without source pickers", () => {
    const resolved = audiobookRows.resolve(ids);
    expect(resolved.order).toEqual(["about", "chapters", "provider_mappings"]);
    expect(resolved.hidden.size).toBe(0);
    for (const id of ids)
      expect(audiobookRows.sources(id, audiobook())).toEqual([]);
  });

  it("applies the user's saved order and hidden rows", () => {
    storeMock.currentUser.preferences[AUDIOBOOK_ROWS_PREFERENCE_KEY] = {
      order: ["chapters", "provider_mappings", "about"],
      hidden: ["about"],
    };
    const resolved = audiobookRows.resolve(ids);
    expect(resolved.order).toEqual(["chapters", "provider_mappings", "about"]);
    expect(resolved.hidden).toEqual(new Set(["about"]));
  });

  it("persists hiding under the audiobook preference key", async () => {
    await audiobookRows.setHidden("chapters", true);
    expect(setPreference).toHaveBeenCalledWith(
      AUDIOBOOK_ROWS_PREFERENCE_KEY,
      expect.objectContaining({ hidden: ["chapters"] }),
    );
  });

  it("persists reordering and resets only audiobook preferences", async () => {
    await audiobookRows.setOrder(
      ["chapters", "about", "provider_mappings"],
      ids,
    );
    expect(setPreference).toHaveBeenLastCalledWith(
      AUDIOBOOK_ROWS_PREFERENCE_KEY,
      expect.objectContaining({
        order: ["chapters", "about", "provider_mappings"],
      }),
    );
    await audiobookRows.reset();
    expect(setPreference).toHaveBeenLastCalledWith(
      AUDIOBOOK_ROWS_PREFERENCE_KEY,
      {
        hidden: [],
        shown: [],
        order: [],
      },
    );
  });
});
