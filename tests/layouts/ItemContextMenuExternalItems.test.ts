/**
 * The server lists items it knows only by an external id: a discography
 * release, a top track. They have no provider mappings and are looked up when
 * they are opened, played or added to the library. Whether one can be played as
 * it is comes from the server: a track can, an album can not.
 */
import {
  showContextMenuForMediaItem,
  showPlayMenuForMediaItem,
} from "@/layouts/default/ItemContextMenu.vue";
import { openExternalItem } from "@/helpers/open_external_item";
import { Scope } from "@/plugins/api/interfaces";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { itemMapping } from "../fixtures/itemMapping";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { track } from "../fixtures/track";

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
    providerManifests: {},
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
vi.mock("@/helpers/open_external_item", () => ({
  openExternalItem: vi.fn(),
}));

// a release as the discography sends it: the release group id in the external
// form, the library artist, and no provider mappings at all
const release = album({
  item_id: "musicbrainz_releasegroupid:rg-1",
  provider: "external",
  provider_mappings: [],
  is_playable: false,
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

describe("the context menu of an external album", () => {
  it("offers opening it and adding it to the library", async () => {
    const labels = (await openMenu()).map((entry) => entry.label);

    expect(labels).toContain("show_info");
    expect(labels).toContain("add_library");
  });

  it("opens it through the lookup that finds it on a music service", async () => {
    const showInfo = (await openMenu()).find(
      (entry) => entry.label === "show_info",
    );

    expect(showInfo).toBeDefined();
    showInfo?.action?.();

    expect(openExternalItem).toHaveBeenCalledWith(release);
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
  // library, so an external item is by definition outside it
  it("does not look for a library counterpart", async () => {
    await openMenu();

    expect(apiMock.getLibraryItem).not.toHaveBeenCalled();
  });

  it("adds it by its uri, which the server looks up", async () => {
    const menu = await openMenu();

    await menu.find((entry) => entry.label === "add_library")?.action?.();

    expect(apiMock.addItemToLibrary).toHaveBeenCalledWith(
      "external://album/musicbrainz_releasegroupid:rg-1",
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

  it("is left out when the rest of a selection is enqueued", async () => {
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
    const add = emittedMenus[0].items
      .find((entry) => entry.label === "enqueue")
      ?.subItems?.find((entry) => entry.label === "queue_option.add");
    expect(add).toBeDefined();
    add?.action?.();

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

describe("the context menu of an external track", () => {
  // a top track as the server lists it: the recording id in the external form,
  // the library artist, and its album in the external form as well
  const topTrack = track({
    item_id: "musicbrainz_recordingid:rec-1",
    provider: "external",
    provider_mappings: [],
    artists: [artist({ item_id: "7", name: "Jeff Buckley" })],
    album: itemMapping({
      item_id: "musicbrainz_albumid:rel-1",
      provider: "external",
      name: "Grace",
      is_playable: false,
    }),
  });

  async function openTrackMenu() {
    await showContextMenuForMediaItem(topTrack, undefined, 0, 0, true, true);
    return emittedMenus[0];
  }

  beforeEach(() => {
    storeMock.activePlayer = { player_id: "p1", available: true };
  });

  afterEach(() => {
    storeMock.activePlayer = undefined;
  });

  it("plays it by its uri, which the server looks up when it plays", async () => {
    const menu = await openTrackMenu();
    const playNow = menu.items.find((entry) => entry.label === "play_now");

    expect(menu.showPlayMenuHeader).toBe(true);
    expect(playNow).toBeDefined();
    playNow?.action?.();

    expect(apiMock.playMedia.mock.calls[0][0]).toEqual([topTrack.uri]);
  });

  it("offers the other queue options too", async () => {
    const enqueue = (await openTrackMenu()).items.find(
      (entry) => entry.label === "enqueue",
    );

    expect(enqueue?.subItems?.length).toBeGreaterThan(0);
  });

  it("gets a play menu", async () => {
    await showPlayMenuForMediaItem(topTrack, undefined, 0, 0);

    expect(emittedMenus).toHaveLength(1);
    expect(emittedMenus[0].items.length).toBeGreaterThan(0);
  });

  it("opens its page and its album through the lookup", async () => {
    const { items } = await openTrackMenu();

    items.find((entry) => entry.label === "show_info")?.action?.();
    items.find((entry) => entry.label === "goto_album")?.action?.();

    expect(openExternalItem).toHaveBeenCalledWith(topTrack);
    expect(openExternalItem).toHaveBeenCalledWith(topTrack.album);
    expect(items.map((entry) => entry.label)).toContain("goto_artist");
  });

  it("adds it to the library by its uri, which the server looks up", async () => {
    const { items } = await openTrackMenu();

    await items.find((entry) => entry.label === "add_library")?.action?.();

    expect(apiMock.addItemToLibrary).toHaveBeenCalledWith(
      "external://track/musicbrainz_recordingid:rec-1",
    );
    expect(apiMock.getLibraryItem).not.toHaveBeenCalled();
  });

  it("offers nothing that needs a track that was found", async () => {
    const labels = (await openTrackMenu()).items.map((entry) => entry.label);

    expect(labels).not.toContain("add_playlist");
    expect(labels).not.toContain("favorites_add");
    expect(labels).not.toContain("favorites_dislike");
    expect(labels).not.toContain("goto_track_radio");
    expect(labels).not.toContain("refresh_item");
    expect(labels).not.toContain("remove_library");
  });
});
