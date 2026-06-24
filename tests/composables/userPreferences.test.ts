import { MediaType } from "@/plugins/api/interfaces";
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

describe("userPreferences - genreContentTypeFilter", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(undefined);
    storeMock.currentUser = { user_id: "u1", preferences: {} };
  });

  it("persists the genre media-type filter under the namespaced key", async () => {
    const { setItemsListingPreference } = useUserPreferences();

    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "genreContentTypeFilter",
      MediaType.AUDIOBOOK,
    );

    expect(readPrefs("librarygenres", "genres").genreContentTypeFilter).toBe(
      MediaType.AUDIOBOOK,
    );
    expect(mockUpdateUser).toHaveBeenCalledWith("u1", {
      preferences: {
        "itemsListing.librarygenres.genres": {
          genreContentTypeFilter: MediaType.AUDIOBOOK,
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
      "genreContentTypeFilter",
      MediaType.PODCAST,
    );

    const prefs = readPrefs("librarygenres", "genres");
    expect(prefs.hideEmptyFilter).toBe(true);
    expect(prefs.genreContentTypeFilter).toBe(MediaType.PODCAST);
  });

  it("keeps the filter isolated per path/itemtype", async () => {
    const { setItemsListingPreference } = useUserPreferences();

    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "genreContentTypeFilter",
      MediaType.PODCAST,
    );

    expect(
      readPrefs("libraryalbums", "albums").genreContentTypeFilter,
    ).toBeUndefined();
  });

  it("clears the filter when set back to undefined (toggle-off)", async () => {
    const { setItemsListingPreference } = useUserPreferences();

    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "genreContentTypeFilter",
      MediaType.PODCAST,
    );
    await setItemsListingPreference(
      "librarygenres",
      "genres",
      "genreContentTypeFilter",
      undefined,
    );

    expect(
      readPrefs("librarygenres", "genres").genreContentTypeFilter,
    ).toBeUndefined();
  });
});
