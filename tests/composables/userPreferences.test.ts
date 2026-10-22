import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicAssistantApi } from "@/plugins/api";
import type { ProviderConfig } from "@/plugins/api/interfaces";
import { user } from "../fixtures/user";

const { mockUpdateUser, mockGetProviderConfigs, storeMock } = vi.hoisted(() => {
  return {
    mockUpdateUser: vi.fn<MusicAssistantApi["updateUser"]>(),
    mockGetProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
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
    getProviderConfigs: mockGetProviderConfigs,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

import {
  pruneStaleProviderFilters,
  runAfterPreferenceWrites,
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";

// `getItemsListingPreferences` returns a computed, so we read it through a fresh
// call after each write to avoid relying on computed caching against the plain
// (non-reactive) store mock.
function readPrefs(path: string, itemtype: string) {
  return useUserPreferences().getItemsListingPreferences(path, itemtype).value;
}

describe("userPreferences - itemsListing", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(user());
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

  it("serializes requests so an older write cannot overwrite a newer preference", async () => {
    let finishFirst!: (value: ReturnType<typeof user>) => void;
    mockUpdateUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    );
    const first = setUserPreference("theme", "dark");
    const second = setUserPreference("language", "fr");
    await vi.waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    finishFirst(user());
    await Promise.all([first, second]);
    expect(mockUpdateUser.mock.calls[1]).toEqual([
      "u1",
      { preferences: { theme: "dark", language: "fr" } },
    ]);
  });

  it("merges simultaneous changes to the same listing", async () => {
    const { setItemsListingPreference } = useUserPreferences();
    await Promise.all([
      setItemsListingPreference(
        "librarygenres",
        "genres",
        "favoriteFilter",
        true,
      ),
      setItemsListingPreference(
        "librarygenres",
        "genres",
        "hideEmptyFilter",
        true,
      ),
    ]);
    expect(readPrefs("librarygenres", "genres")).toEqual({
      favoriteFilter: true,
      hideEmptyFilter: true,
    });
  });

  it("drops queued writes when the signed-in account changes", async () => {
    let finishFirst!: (value: ReturnType<typeof user>) => void;
    mockUpdateUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    );
    const first = setUserPreference("theme", "dark");
    const second = setUserPreference("language", "fr");
    await vi.waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(1));
    storeMock.currentUser = { user_id: "u2", preferences: {} };
    finishFirst(user());
    await Promise.all([first, second]);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(storeMock.currentUser.preferences).toEqual({});
  });

  it("rolls back a failed write and continues the queue", async () => {
    const loggedError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateUser.mockRejectedValueOnce(new Error("Cannot save"));
    await Promise.all([
      setUserPreference("theme", "dark"),
      setUserPreference("language", "fr"),
    ]);
    expect(storeMock.currentUser?.preferences).toEqual({ language: "fr" });
    expect(mockUpdateUser.mock.calls[1]).toEqual([
      "u1",
      { preferences: { language: "fr" } },
    ]);
    loggedError.mockRestore();
  });

  it("holds preference writes until a user refresh has finished", async () => {
    let finishRefresh!: () => void;
    const refresh = runAfterPreferenceWrites(async () => {
      await new Promise<void>((resolve) => {
        finishRefresh = resolve;
      });
      storeMock.currentUser!.preferences = { theme: "light" };
    });
    const write = setUserPreference("language", "fr");
    await vi.waitFor(() => expect(finishRefresh).toBeDefined());
    expect(mockUpdateUser).not.toHaveBeenCalled();
    finishRefresh();
    await Promise.all([refresh, write]);
    expect(storeMock.currentUser?.preferences).toEqual({
      theme: "light",
      language: "fr",
    });
  });
});

describe("pruneStaleProviderFilters", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(user());
    mockGetProviderConfigs.mockReset();
    mockGetProviderConfigs.mockResolvedValue([
      { instance_id: "spotify1" } as ProviderConfig,
    ]);
  });

  it("drops deconfigured provider ids from both itemsListing and discover row filters", async () => {
    storeMock.currentUser = {
      user_id: "u1",
      preferences: {
        "itemsListing.libraryalbums.albums": {
          providerFilter: ["spotify1", "removed1"],
        },
        "discover.hiddenProviders.recently_played": ["spotify1", "removed1"],
      },
    };

    await pruneStaleProviderFilters();

    expect(storeMock.currentUser.preferences).toEqual({
      "itemsListing.libraryalbums.albums": { providerFilter: ["spotify1"] },
      "discover.hiddenProviders.recently_played": ["spotify1"],
    });
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no ids reference a deconfigured provider", async () => {
    storeMock.currentUser = {
      user_id: "u1",
      preferences: {
        "discover.hiddenProviders.recently_played": ["spotify1"],
      },
    };

    await pruneStaleProviderFilters();

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("deletes a discover row filter key once every hidden id is pruned", async () => {
    storeMock.currentUser = {
      user_id: "u1",
      preferences: {
        "discover.hiddenProviders.recently_played": ["removed1"],
      },
    };

    await pruneStaleProviderFilters();

    expect(storeMock.currentUser.preferences).toEqual({});
  });
});
