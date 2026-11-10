import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
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
});

describe("writing a preference", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(user());
    storeMock.currentUser = { user_id: "u1", preferences: { theme: "dark" } };
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("keeps the preferences it was not asked about, and says it landed", async () => {
    await expect(setUserPreference("language", "nl")).resolves.toBe(true);

    expect(mockUpdateUser).toHaveBeenCalledWith("u1", {
      preferences: { theme: "dark", language: "nl" },
    });
  });

  it("asks the server for nothing while nobody is signed in", async () => {
    storeMock.currentUser = null;

    await expect(setUserPreference("language", "nl")).resolves.toBe(false);

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("says so when the server would not take it", async () => {
    mockUpdateUser.mockRejectedValue(new Error("boom"));

    await expect(setUserPreference("language", "nl")).resolves.toBe(false);

    // what the account had is what it still holds: a value the server refused
    // must not sit there looking saved, nor ride along on the next write
    expect(storeMock.currentUser?.preferences).toEqual({ theme: "dark" });
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("puts it back on the reactive store the app runs on", async () => {
    // the app's store hands the preferences back as a reactive proxy, so the
    // write has to recognise its own set by the object underneath
    storeMock.currentUser = reactive({
      user_id: "u1",
      preferences: { theme: "dark" } as Record<string, unknown>,
    });
    mockUpdateUser.mockRejectedValue(new Error("boom"));

    await expect(setUserPreference("language", "nl")).resolves.toBe(false);

    expect(storeMock.currentUser?.preferences).toEqual({ theme: "dark" });
  });

  it("leaves preferences that were replaced while it was in flight alone", async () => {
    let failWrite: (error: Error) => void = () => {};
    mockUpdateUser.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failWrite = reject;
        }),
    );

    const write = setUserPreference("language", "nl");
    // the server handed the app a fresh user while the write was on its way
    storeMock.currentUser = { user_id: "u1", preferences: { theme: "light" } };
    failWrite(new Error("boom"));

    await expect(write).resolves.toBe(false);

    // putting the old set back would undo what has landed since
    expect(storeMock.currentUser?.preferences).toEqual({ theme: "light" });
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
