/**
 * A discography lists releases that are on none of the user's music services:
 * MusicBrainz items without provider mappings. They can be opened and added to
 * the library, which the server resolves to a real album, but not played.
 */
import {
  showContextMenuForMediaItem,
  showPlayMenuForMediaItem,
} from "@/layouts/default/ItemContextMenu.vue";
import { Scope } from "@/plugins/api/interfaces";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, emittedMenus, storeMock } = vi.hoisted(() => ({
  emittedMenus: [] as ContextMenuDialogEvent[],
  apiMock: {
    addItemToFavorites: vi.fn(),
    addItemToLibrary: vi.fn(),
    removeItemFromLibrary: vi.fn(),
    getItem: vi.fn(),
    getLibraryItem: vi.fn(),
    getProvider: vi.fn(),
    getCoreConfigValue: vi.fn(),
    playMedia: vi.fn(),
    providers: {},
    players: {},
  },
  storeMock: {
    activePlayer: undefined as
      { player_id: string; available: boolean } | undefined,
    activePlayerId: undefined,
    enabledPlugins: new Set<string>(),
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
// signed in as a member, which may write the library
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../fixtures/scopes");
  return {
    authManager: { hasScope: vi.fn(scopeChecker(BUILTIN_ROLE_SCOPES.user)) },
  };
});
vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((_type: string, payload: ContextMenuDialogEvent) => {
      emittedMenus.push(payload);
    }),
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// a release as the discography sends it: the MusicBrainz release group id, the
// library artist, and no provider mappings at all
const release = album({
  item_id: "rg-1",
  provider: "musicbrainz",
  provider_mappings: [],
  year: 1994,
  artists: [artist({ item_id: "7", name: "Jeff Buckley" })],
});

/** Opens the menu the way a row or card does, play actions included. */
async function openMenu() {
  await showContextMenuForMediaItem(release, undefined, 0, 0, true, true);
  return emittedMenus[0].items;
}

beforeEach(() => {
  vi.clearAllMocks();
  // what the lookup would answer if the menu did make it
  apiMock.getLibraryItem.mockResolvedValue(null);
  apiMock.addItemToLibrary.mockResolvedValue(undefined);
  emittedMenus.length = 0;
});

describe("the context menu of a MusicBrainz release", () => {
  it("offers opening it and adding it to the library", async () => {
    const labels = (await openMenu()).map((entry) => entry.label);

    expect(labels).toContain("show_info");
    expect(labels).toContain("add_library");
  });

  it("offers nothing that needs an item on a music service", async () => {
    const labels = (await openMenu()).map((entry) => entry.label);

    // nothing to play or to put in a playlist, nothing stored to favorite,
    // refresh or remove
    expect(labels).not.toContain("play_now");
    expect(labels).not.toContain("add_playlist");
    expect(labels).not.toContain("shortcut.add_to");
    expect(labels).not.toContain("favorites_add");
    expect(labels).not.toContain("refresh_item");
    expect(labels).not.toContain("remove_library");
    expect(labels.filter((label) => label.startsWith("play_"))).toEqual([]);
  });

  it("gets no play menu at all", async () => {
    await showPlayMenuForMediaItem(release, undefined, 0, 0);

    expect(emittedMenus).toHaveLength(0);
  });

  it("has no player header, there being nothing to play on it", async () => {
    await openMenu();

    expect(emittedMenus[0].showPlayMenuHeader).toBe(false);
  });

  it("keeps the player header on a release that is on a music service", async () => {
    const mapping = providerMapping();
    apiMock.providers = {
      [mapping.provider_instance]: { available: true, supported_features: [] },
    };

    await showContextMenuForMediaItem(
      album({ item_id: "1", provider_mappings: [mapping] }),
      undefined,
      0,
      0,
      true,
      true,
    );
    apiMock.providers = {};

    expect(emittedMenus[0].showPlayMenuHeader).toBe(true);
  });

  // the server hands back the library album for a release that is in the
  // library, so a MusicBrainz item is by definition outside it
  it("does not look for a library counterpart", async () => {
    await openMenu();

    expect(apiMock.getLibraryItem).not.toHaveBeenCalled();
  });

  it("adds it by its uri, which the server resolves to a real album", async () => {
    const menu = await openMenu();

    await menu.find((entry) => entry.label === "add_library")?.action?.();

    expect(apiMock.addItemToLibrary).toHaveBeenCalledWith(
      "musicbrainz://album/rg-1",
    );
  });

  it("swallows the refusal when no music service has it", async () => {
    apiMock.addItemToLibrary.mockRejectedValue(new Error("not available"));
    const menu = await openMenu();

    // the api plugin already showed the server's message as a toast; the suite
    // fails on a rejection nobody handles
    await menu.find((entry) => entry.label === "add_library")?.action?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(apiMock.addItemToLibrary).toHaveBeenCalledTimes(1);
  });

  it("leaves it out of a bulk removal from the library", async () => {
    const inLibrary = album({
      item_id: "1",
      provider_mappings: [providerMapping({ in_library: true })],
    });
    apiMock.getLibraryItem.mockResolvedValue(inLibrary);

    await showContextMenuForMediaItem([inLibrary, release], undefined, 0, 0);
    const remove = emittedMenus[0].items.find(
      (entry) => entry.label === "remove_library",
    );
    await remove?.action?.();
    // the removal asks for confirmation first
    const dialog = emittedMenus.find((payload) => "onConfirm" in payload) as
      { onConfirm: () => void } | undefined;
    dialog?.onConfirm();

    expect(apiMock.removeItemFromLibrary).toHaveBeenCalledTimes(1);
    expect(apiMock.removeItemFromLibrary).toHaveBeenCalledWith(
      inLibrary.media_type,
      "1",
    );
  });

  it("is left out when the rest of a selection is played", async () => {
    const mapping = providerMapping({ in_library: true });
    const inLibrary = album({ item_id: "1", provider_mappings: [mapping] });
    apiMock.getLibraryItem.mockResolvedValue(inLibrary);
    apiMock.providers = {
      [mapping.provider_instance]: { available: true, supported_features: [] },
    };
    storeMock.activePlayer = { player_id: "p1", available: true };

    await showContextMenuForMediaItem(
      [inLibrary, release],
      undefined,
      0,
      0,
      true,
      true,
    );
    apiMock.providers = {};
    storeMock.activePlayer = undefined;
    const playNow = emittedMenus[0].items.find(
      (entry) => entry.label === "play_now",
    );
    expect(playNow).toBeDefined();
    playNow?.action?.();

    // the queue option is whatever the server's default is; the uris matter
    expect(apiMock.playMedia.mock.calls[0][0]).toEqual([inLibrary.uri]);
  });

  it("is left out when the rest of a selection goes into a playlist", async () => {
    const mapping = providerMapping({ in_library: true });
    const inLibrary = album({ item_id: "1", provider_mappings: [mapping] });
    apiMock.getLibraryItem.mockResolvedValue(inLibrary);
    apiMock.providers = {
      [mapping.provider_instance]: { available: true, supported_features: [] },
    };

    await showContextMenuForMediaItem([inLibrary, release], undefined, 0, 0);
    emittedMenus[0].items
      .find((entry) => entry.label === "add_playlist")
      ?.action?.();
    apiMock.providers = {};

    // the dialog's payload is the last emit
    const dialog = emittedMenus[emittedMenus.length - 1] as unknown as {
      items: Array<{ item_id: string }>;
    };
    expect(dialog.items.map((item) => item.item_id)).toEqual(["1"]);
  });

  it("is not marked a favorite along with the rest of a selection", async () => {
    const mapping = providerMapping({ in_library: true });
    const inLibrary = album({ item_id: "1", provider_mappings: [mapping] });
    apiMock.getLibraryItem.mockResolvedValue(inLibrary);
    // a favorite is only offered for an album on an available music service
    apiMock.providers = {
      [mapping.provider_instance]: { available: true, supported_features: [] },
    };

    await showContextMenuForMediaItem([inLibrary, release], undefined, 0, 0);
    apiMock.providers = {};
    await emittedMenus[0].items
      .find((entry) => entry.label === "favorites_add")
      ?.action?.();

    expect(inLibrary.favorite).toBe(true);
    expect(release.favorite).toBeNull();
  });

  // the refresh is what an unavailable item is otherwise offered, and there is
  // no stored item here to refresh
  it("offers no refresh to a library manager either", async () => {
    const { authManager } = await import("@/plugins/auth");
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );

    const labels = (await openMenu()).map((entry) => entry.label);

    expect(labels).toContain("add_library");
    expect(labels).not.toContain("refresh_item");
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
  });
});
