import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUpdateUser, storeMock } = vi.hoisted(() => {
  return {
    mockUpdateUser: vi.fn(),
    storeMock: {
      currentUser: null as {
        user_id: string;
        preferences?: Record<string, unknown>;
      } | null,
    },
  };
});

vi.mock("@/plugins/api", () => ({
  api: {
    updateUser: mockUpdateUser,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

import { useUserPreferences } from "@/composables/userPreferences";

// `getItemsListingPreferences` returns a computed, so we read it through a fresh
// call after each write to avoid relying on computed caching against the plain
// (non-reactive) store mock.
function readPrefs(path: string, itemtype: string) {
  return useUserPreferences().getItemsListingPreferences(path, itemtype).value;
}

describe("userPreferences - itemsListing", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(undefined);
    storeMock.currentUser = { user_id: "u1", preferences: {} };
  });

  it("persists a filter under the namespaced key", async () => {
    const { setItemsListingPreference } = useUserPreferences();

    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "hideEmptyFilter",
      true,
    );

    expect(readPrefs("librarygenres", "genres").hideEmptyFilter).toBe(true);
    expect(mockUpdateUser).toHaveBeenCalledWith("u1", {
      preferences: {
        "itemsListing.librarygenres.genres": {
          hideEmptyFilter: true,
        },
      },
    });
  });

  it("merges with sibling filter keys without clobbering them", async () => {
    const { setItemsListingPreference } = useUserPreferences();

    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "hideEmptyFilter",
      true,
    );
    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "favoriteFilter",
      true,
    );

    const prefs = readPrefs("librarygenres", "genres");
    expect(prefs.hideEmptyFilter).toBe(true);
    expect(prefs.favoriteFilter).toBe(true);
  });

  it("keeps the filter isolated per path/itemtype", async () => {
    const { setItemsListingPreference } = useUserPreferences();

    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "favoriteFilter",
      true,
    );

    expect(readPrefs("libraryalbums", "albums").favoriteFilter).toBeUndefined();
  });

  it("clears the filter when set back to undefined (toggle-off)", async () => {
    const { setItemsListingPreference } = useUserPreferences();

    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "favoriteFilter",
      true,
    );
    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "favoriteFilter",
      undefined,
    );

    expect(readPrefs("librarygenres", "genres").favoriteFilter).toBeUndefined();
  });
});
