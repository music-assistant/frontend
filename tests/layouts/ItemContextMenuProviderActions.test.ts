/**
 * The menus of a media item offer the menu entries a provider declares in its
 * manifest, and run them through the one command for it.
 */
import {
  getDeclaredContextMenuItems,
  getPlaybackContextMenuItems,
  showContextMenuForMediaItem,
  showPlayMenuForMediaItem,
  type ContextMenuItem,
} from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import {
  type MediaItemType,
  MediaType,
  type ProviderMenuAction,
  ProviderType,
  QueueOption,
  Scope,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, reactive } from "vue";
import { providerManifest } from "../fixtures/providerManifest";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { album } from "../fixtures/album";
import { track } from "../fixtures/track";

const { apiMock, emittedMenus, hasScope, storeMock, toastMock } = vi.hoisted(
  () => ({
    emittedMenus: [] as ContextMenuDialogEvent[],
    apiMock: {
      providers: {} as Record<string, unknown>,
      providerManifests: {} as Record<string, unknown>,
      players: {},
      getCoreConfigValue: vi.fn(),
      getLibraryItem: vi.fn(),
      getProvider: vi.fn(),
      invokeProviderMenuAction: vi.fn(),
      playMedia: vi.fn(),
    },
    hasScope: vi.fn<(scope: Scope) => boolean>(),
    storeMock: {
      activePlayer: undefined as { player_id: string } | undefined,
      activePlayerId: undefined as string | undefined,
      enabledPlugins: new Set<string>(),
    },
    toastMock: { success: vi.fn(), error: vi.fn() },
  }),
);

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((_type: string, payload: ContextMenuDialogEvent) => {
      emittedMenus.push(payload);
    }),
  },
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const ASK: ProviderMenuAction = {
  id: "show_item",
  label: "Ask the demo plugin about this",
  media_types: [MediaType.TRACK],
  scope: Scope.LIBRARY_READ,
  icon: "mdi-information-outline",
  requires_player: false,
};
const SEND: ProviderMenuAction = {
  id: "send",
  label: "Send to the frame",
  media_types: [MediaType.TRACK],
  scope: Scope.QUEUES_CONTROL,
  icon: null,
  requires_player: true,
};

// a track of the test provider, which is loaded
const song = track({ provider_mappings: [providerMapping()] });
// a release known only by an external id, which can not be played as it is
const release = album({
  item_id: "musicbrainz_releasegroupid:rg-1",
  provider: "external",
  provider_mappings: [],
  is_playable: false,
});
// a track known only by an external id, which the server looks up when played
const externalSong = track({
  item_id: "isrc:USX9P0812345",
  provider: "external",
  provider_mappings: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  emittedMenus.length = 0;
  hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  apiMock.getLibraryItem.mockResolvedValue(null);
  apiMock.getCoreConfigValue.mockResolvedValue(QueueOption.REPLACE);
  apiMock.invokeProviderMenuAction.mockResolvedValue(null);
  storeMock.activePlayer = { player_id: "player-1" };
  storeMock.activePlayerId = "player-1";
  apiMock.providers = {
    "test_provider--1": { available: true, supported_features: [] },
    demo: instance("demo"),
  };
  apiMock.providerManifests = { demo: manifest([ASK, SEND]) };
});

describe("the menu of a media item", () => {
  it("ends with one entry per plugin, its entries in a submenu under it", async () => {
    const items = await itemMenu([song]);

    const last = items.at(-1)!;
    expect(last.text).toBe("Demo demo");
    expect(last.subItems!.map((sub) => [sub.text, sub.icon])).toEqual([
      ["Ask the demo plugin about this", "mdi-information-outline"],
      ["Send to the frame", expect.anything()],
    ]);
    expect(items.filter((item) => item.text)).toHaveLength(1);
  });

  it("runs the entry for the item, without a player, and says what the provider answered", async () => {
    apiMock.invokeProviderMenuAction.mockResolvedValue({
      message: "The demo plugin was asked about it",
      open_url: null,
    });

    await choose(await itemMenu([song]), ASK.label);

    expect(apiMock.invokeProviderMenuAction).toHaveBeenCalledExactlyOnceWith(
      "demo",
      "show_item",
      song.uri,
      undefined,
    );
    expect(toastMock.success).toHaveBeenCalledWith(
      "The demo plugin was asked about it",
    );
  });

  it("runs an entry that acts on a player on the player chosen when it is picked", async () => {
    const items = await itemMenu([song]);
    storeMock.activePlayer = { player_id: "player-2" };

    await choose(items, SEND.label);

    expect(apiMock.invokeProviderMenuAction).toHaveBeenCalledWith(
      "demo",
      "send",
      song.uri,
      "player-2",
    );
  });

  it("holds an entry that acts on a player without one, the submenu still there", async () => {
    storeMock.activePlayer = undefined;

    const plugin = (await itemMenu([song])).at(-1)!;

    expect(plugin.disabled).toBeUndefined();
    expect(plugin.subItems!.map((sub) => [sub.text, sub.disabled])).toEqual([
      ["Ask the demo plugin about this", false],
      ["Send to the frame", true],
    ]);
  });

  it("offers only the entries that act on no player in a menu without the ways to play", async () => {
    await showContextMenuForMediaItem([song], undefined, 0, 0, false);
    const plugin = emittedMenus.at(-1)!.items.at(-1)!;

    expect(plugin.subItems!.map((sub) => sub.text)).toEqual([
      "Ask the demo plugin about this",
    ]);
    expect(getDeclaredContextMenuItems([song])).toEqual([
      expect.objectContaining({
        subItems: [expect.objectContaining({ text: ASK.label })],
      }),
    ]);
  });

  it("says the action is done when the provider answers nothing", async () => {
    await choose(await itemMenu([song]), ASK.label);

    expect(toastMock.success).toHaveBeenCalledWith("Action completed");
  });

  it("leaves a failure to the api's own message", async () => {
    apiMock.invokeProviderMenuAction.mockRejectedValue(new Error("refused"));

    await choose(await itemMenu([song]), ASK.label);

    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("offers nothing for a selection of more than one item", async () => {
    const items = await itemMenu([song, song]);

    expect(items.filter((item) => item.text)).toEqual([]);
  });

  it("offers nothing for an item that is not available", () => {
    const unavailable = track({
      provider_mappings: [providerMapping({ available: false })],
    });

    expect(getDeclaredContextMenuItems([unavailable])).toEqual([]);
  });

  it("offers the entries for an external item, run by its own uri", async () => {
    await choose(getDeclaredContextMenuItems([externalSong]), ASK.label);
    expect(apiMock.invokeProviderMenuAction).toHaveBeenCalledWith(
      "demo",
      "show_item",
      "external://track/isrc:USX9P0812345",
      undefined,
    );

    await showPlayMenuForMediaItem(externalSong);
    expect(emittedMenus.at(-1)!.items.at(-1)!.text).toBe("Demo demo");
  });

  it("follows the providers when read in a computed", () => {
    apiMock.providers = reactive({ ...apiMock.providers });
    const names = computed(() =>
      getDeclaredContextMenuItems([song]).map((item) => item.text),
    );
    expect(names.value).toEqual(["Demo demo"]);

    (apiMock.providers.demo as { name: string }).name = "Kitchen helper";
    expect(names.value).toEqual(["Kitchen helper"]);

    delete apiMock.providers.demo;
    expect(names.value).toEqual([]);
  });

  it("shows a message that equals a translation key as it is", async () => {
    apiMock.invokeProviderMenuAction.mockResolvedValue({
      message: "show_info",
      open_url: null,
    });

    await choose(await itemMenu([song]), ASK.label);

    expect(toastMock.success).toHaveBeenCalledWith("show_info");
  });

  it.each([
    ["a member", Scope.LIBRARY_WRITE, true, BUILTIN_ROLE_SCOPES.user],
    ["a guest", Scope.LIBRARY_WRITE, false, BUILTIN_ROLE_SCOPES.guest],
    ["a member", Scope.ALL, false, BUILTIN_ROLE_SCOPES.user],
    ["an admin", Scope.ALL, true, BUILTIN_ROLE_SCOPES.admin],
  ])(
    "offers %s an entry that needs %s: %s",
    async (_who, scope, offered, scopes) => {
      hasScope.mockImplementation(scopeChecker(scopes));
      apiMock.providerManifests = { demo: manifest([{ ...ASK, scope }]) };

      const items = await itemMenu([song]);

      expect(entries(items).includes(ASK.label)).toBe(offered);
    },
  );
});

describe("the ways to play a media item", () => {
  it("leave the plugin entries to the end of the menu", async () => {
    const items = await getPlaybackContextMenuItems([song]);

    expect(items.filter((item) => item.text)).toEqual([]);
  });

  it("end the menu of the play button with the entries that act on a player, held without a player as the others", async () => {
    await showPlayMenuForMediaItem(song);
    const withPlayer = emittedMenus[0].items.at(-1)!;
    expect(withPlayer.text).toBe("Demo demo");
    expect(withPlayer.subItems!.map((sub) => [sub.text, sub.disabled])).toEqual(
      [["Send to the frame", false]],
    );

    storeMock.activePlayer = undefined;
    await showPlayMenuForMediaItem(song);
    const withoutPlayer = emittedMenus[1].items;
    expect(withoutPlayer.at(-1)!.disabled).toBeUndefined();
    expect(withoutPlayer.at(-1)!.subItems![0].disabled).toBe(true);
    expect(withoutPlayer.at(-2)!.disabled).toBe(true);
  });

  it("are left out for a selection of two, of which one can be played", async () => {
    await showPlayMenuForMediaItem([song, release]);
    expect(emittedMenus[0].items.filter((item) => item.text)).toEqual([]);
  });

  it("offer one entry per instance, named after it", async () => {
    apiMock.providers = {
      ...apiMock.providers,
      "demo--2": instance("demo--2"),
    };

    await showPlayMenuForMediaItem(song);

    expect(
      emittedMenus[0].items
        .filter((item) => item.text)
        .map((item) => [item.text, ...entries([item])]),
    ).toEqual([
      ["Demo demo", "Send to the frame"],
      ["Demo demo--2", "Send to the frame"],
    ]);
  });
});

function instance(instanceId: string) {
  return {
    type: ProviderType.PLUGIN,
    domain: "demo",
    name: `Demo ${instanceId}`,
    instance_id: instanceId,
    supported_features: [],
    available: true,
    is_streaming_provider: false,
  };
}

function manifest(actions: ProviderMenuAction[]) {
  return {
    ...providerManifest({ domain: "demo", type: ProviderType.PLUGIN }),
    menu_actions: actions,
  };
}

/** The menu of a media item with the ways to play it, as it opens. */
async function itemMenu(items: MediaItemType[]) {
  await showContextMenuForMediaItem(items, undefined, 0, 0, true, true);
  return emittedMenus.at(-1)!.items;
}

/** The texts of the entries in the plugins' submenus of a menu. */
function entries(items: ContextMenuItem[]) {
  return items.flatMap((item) =>
    (item.subItems ?? []).flatMap((sub) => (sub.text ? [sub.text] : [])),
  );
}

async function choose(items: ContextMenuItem[], text: string) {
  items.flatMap((item) => item.subItems ?? []).find((sub) => sub.text === text)!
    .action!();
  await flushPromises();
}
