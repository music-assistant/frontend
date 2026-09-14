import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// signed in as a member unless a test says otherwise
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../fixtures/scopes");
  return {
    authManager: { hasScope: vi.fn(scopeChecker(BUILTIN_ROLE_SCOPES.user)) },
  };
});

import { authManager } from "@/plugins/auth";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

import {
  pruneStaleProviderFilters,
  runAfterPreferenceWrites,
  setUserPreference,
  setUserPreferences,
  updateUserPreferences,
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
    // no options: the general case leaves the api's own error handling alone
    expect(mockUpdateUser).toHaveBeenCalledWith(
      "u1",
      {
        preferences: {
          "itemsListing.librarygenres.genres": {
            hideEmptyFilter: true,
          },
        },
      },
      undefined,
    );
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

/** Wait for the writes in flight to have reached the server. */
async function untilSent(calls: number) {
  await vi.waitFor(() => expect(mockUpdateUser).toHaveBeenCalledTimes(calls));
}

// What the write path says to the console when it will not write, or could
// not: kept quiet for the whole file and handed back however a test ends, so
// an assertion that fails cannot leave the console stubbed for the next one.
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("writing preferences", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockUpdateUser.mockResolvedValue(user());
    storeMock.currentUser = { user_id: "u1", preferences: { theme: "dark" } };
  });

  it("keeps the preferences it was not asked about", async () => {
    await setUserPreference("language", "nl");

    expect(mockUpdateUser).toHaveBeenCalledWith(
      "u1",
      { preferences: { theme: "dark", language: "nl" } },
      undefined,
    );
  });

  it("writes the keys of one answer in a single update", async () => {
    const saved = await setUserPreferences({
      show_waveform: true,
      visualizer_enabled: true,
    });

    expect(saved).toBe(true);

    // one update, so the account never holds half of an answer
    expect(mockUpdateUser).toHaveBeenCalledOnce();
    expect(mockUpdateUser).toHaveBeenCalledWith(
      "u1",
      {
        preferences: {
          theme: "dark",
          show_waveform: true,
          visualizer_enabled: true,
        },
      },
      undefined,
    );
    expect(storeMock.currentUser?.preferences).toEqual({
      theme: "dark",
      show_waveform: true,
      visualizer_enabled: true,
    });
  });

  it("asks the server for nothing while nobody is signed in", async () => {
    storeMock.currentUser = null;

    await expect(setUserPreferences({ show_waveform: true })).resolves.toBe(
      false,
    );

    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("says so when the server would not take them", async () => {
    mockUpdateUser.mockRejectedValue(new Error("boom"));

    // whoever asked gets to tell the user; the write itself stays quiet
    await expect(setUserPreferences({ show_waveform: true })).resolves.toBe(
      false,
    );

    // and what the account had is what it still holds: a value the server
    // refused must not sit there looking saved, nor ride along on the next write
    expect(storeMock.currentUser?.preferences).toEqual({ theme: "dark" });
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("leaves preferences that were replaced while it was in flight alone", async () => {
    let failWrite: (error: Error) => void = () => {};
    mockUpdateUser.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failWrite = reject;
        }),
    );

    const write = setUserPreferences({ show_waveform: true });
    await untilSent(1);
    // the server handed the app a fresh user while the write was on its way
    storeMock.currentUser = { user_id: "u1", preferences: { theme: "light" } };
    failWrite(new Error("boom"));

    await expect(write).resolves.toBe(false);

    // putting the old set back would undo what has landed since
    expect(storeMock.currentUser?.preferences).toEqual({ theme: "light" });
  });

  it("sends a write that was asked for while another was in flight after it", async () => {
    let landFirst: () => void = () => {};
    mockUpdateUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landFirst = () => resolve(user());
        }),
    );

    const answer = setUserPreferences({ "onboarding.persona": "regular" });
    const marker = setUserPreferences({ "onboarding.welcome": "2026-01-02" });
    await untilSent(1);

    // one at a time: every write sends the whole set, so the second reads what
    // the first added instead of what the account held when it was asked for
    expect(mockUpdateUser).toHaveBeenCalledOnce();

    landFirst();
    await Promise.all([answer, marker]);

    expect(mockUpdateUser).toHaveBeenCalledTimes(2);
    expect(mockUpdateUser.mock.calls[1][1].preferences).toEqual({
      theme: "dark",
      "onboarding.persona": "regular",
      "onboarding.welcome": "2026-01-02",
    });
  });

  it("drops a write for an account that is no longer the one signed in", async () => {
    let landFirst: () => void = () => {};
    mockUpdateUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landFirst = () => resolve(user());
        }),
    );

    const first = setUserPreferences({ theme: "light" });
    const queued = setUserPreferences({ show_waveform: true });
    await untilSent(1);
    // whoever was signed in when the second was asked for is not who is signed
    // in by the time it comes up
    storeMock.currentUser = { user_id: "u2", preferences: {} };
    landFirst();

    await expect(first).resolves.toBe(true);
    await expect(queued).resolves.toBe(false);

    // one account's answer must never land on another's
    expect(mockUpdateUser).toHaveBeenCalledOnce();
    expect(storeMock.currentUser?.preferences).toEqual({});
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("sends nothing when the change finds nothing to do", async () => {
    // the caller looked at what is there and answered with no change
    await expect(updateUserPreferences(() => null)).resolves.toBe(true);

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("takes a turn for whoever else reads and replaces the preferences", async () => {
    let landWrite: () => void = () => {};
    mockUpdateUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landWrite = () => resolve(user());
        }),
    );

    const order: string[] = [];
    const write = setUserPreferences({ theme: "light" });
    const refresh = runAfterPreferenceWrites(async () => {
      order.push("refreshed");
    });
    await untilSent(1);

    // a refresh that overtook the write would put the preferences back as they
    // were before it, for the next write to send on
    expect(order).toEqual([]);

    landWrite();
    await Promise.all([write, refresh]);

    expect(order).toEqual(["refreshed"]);
  });

  it("holds a write up until the turn before it is done", async () => {
    let landTask: () => void = () => {};
    const task = runAfterPreferenceWrites(
      () =>
        new Promise<void>((resolve) => {
          landTask = resolve;
        }),
    );

    const write = setUserPreferences({ theme: "light" });
    await Promise.resolve();

    // the write reads the preferences when its turn comes, which is after
    // whatever is replacing them right now
    expect(mockUpdateUser).not.toHaveBeenCalled();

    landTask();
    await Promise.all([task, write]);

    expect(mockUpdateUser).toHaveBeenCalledOnce();
  });

  it("hands the command options it was given to the server call", async () => {
    // what a caller with a message of its own keeps the api's toast away with
    await setUserPreferences(
      { show_waveform: true },
      { suppressGlobalError: true },
    );

    expect(mockUpdateUser).toHaveBeenCalledWith("u1", expect.anything(), {
      suppressGlobalError: true,
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
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
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

  it("takes the answer that was still being written with it", async () => {
    storeMock.currentUser = {
      user_id: "u1",
      preferences: {
        "discover.hiddenProviders.recently_played": ["spotify1", "removed1"],
      },
    };
    let landAnswer: () => void = () => {};
    mockUpdateUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landAnswer = () => resolve(user());
        }),
    );

    const answer = setUserPreferences({ "onboarding.persona": "regular" });
    const pruning = pruneStaleProviderFilters();
    await untilSent(1);
    landAnswer();
    await Promise.all([answer, pruning]);

    // the prune waits its turn like everything else and reads the preferences
    // as they are by then, so the answer it queued behind is still there
    expect(storeMock.currentUser?.preferences).toEqual({
      "onboarding.persona": "regular",
      "discover.hiddenProviders.recently_played": ["spotify1"],
    });
    expect(mockUpdateUser).toHaveBeenCalledTimes(2);
  });

  it("leaves the filters of the account it started on alone", async () => {
    storeMock.currentUser = {
      user_id: "u1",
      preferences: {
        "discover.hiddenProviders.recently_played": ["removed1"],
      },
    };
    let landConfigs: () => void = () => {};
    mockGetProviderConfigs.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          landConfigs = () =>
            resolve([{ instance_id: "spotify1" } as ProviderConfig]);
        }),
    );

    const pruning = pruneStaleProviderFilters();
    // somebody else is signed in before the configurations come back
    storeMock.currentUser = { user_id: "u2", preferences: {} };
    landConfigs();
    await pruning;

    // the configurations were listed for the account that asked, and the scope
    // check was made on its behalf: neither says anything about this one
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(storeMock.currentUser?.preferences).toEqual({});
  });

  it("leaves the filters alone for a role that may not list the providers", async () => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );
    storeMock.currentUser = {
      user_id: "u1",
      preferences: {
        "discover.hiddenProviders.recently_played": ["removed1"],
      },
    };

    await pruneStaleProviderFilters();

    expect(mockGetProviderConfigs).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});
