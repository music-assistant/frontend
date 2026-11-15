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
// an item known only by an external id
const release = track({
  provider: "external",
  provider_mappings: [providerMapping()],
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
  it("ends with the entries that act on no player, shown as they are", async () => {
    const items = await itemMenu([song]);

    const last = items.at(-1)!;
    expect(last.text).toBe("Ask the demo plugin about this");
    expect(last.icon).toBe("mdi-information-outline");
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

  it.each([
    [
      "that is not available",
      track({ provider_mappings: [providerMapping({ available: false })] }),
    ],
    ["known only by an external id", release],
  ])("offers nothing for an item %s", (_case, item) => {
    expect(getDeclaredContextMenuItems([item])).toEqual([]);
  });

  it("follows the providers when read in a computed", () => {
    apiMock.providers = reactive({ ...apiMock.providers });
    const names = computed(() =>
      getDeclaredContextMenuItems([song]).map((item) => item.addedBy),
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

      expect(items.some((item) => item.text === ASK.label)).toBe(offered);
    },
  );
});

describe("the ways to play a media item", () => {
  it("end with the entries that act on a player, which get the chosen player", async () => {
    const items = await getPlaybackContextMenuItems([song]);

    expect(items.map((item) => item.text ?? item.label).slice(-2)).toEqual([
      "enqueue",
      "Send to the frame",
    ]);
    // the player chosen in the menu's header when the entry is picked
    storeMock.activePlayer = { player_id: "player-2" };
    await choose(items, SEND.label);
    expect(apiMock.invokeProviderMenuAction).toHaveBeenCalledWith(
      "demo",
      "send",
      song.uri,
      "player-2",
    );
  });

  it("are left out without a player, as the other ways to play", async () => {
    storeMock.activePlayer = undefined;

    expect(await getPlaybackContextMenuItems([song])).toEqual([]);
  });

  it("end the menu of the play button, held without a player as the others", async () => {
    await showPlayMenuForMediaItem(song);
    const withPlayer = emittedMenus[0].items.at(-1)!;
    expect(withPlayer.text).toBe("Send to the frame");
    expect(withPlayer.disabled).toBe(false);

    storeMock.activePlayer = undefined;
    await showPlayMenuForMediaItem(song);
    const withoutPlayer = emittedMenus[1].items;
    expect(withoutPlayer.at(-1)!.disabled).toBe(true);
    expect(withoutPlayer.at(-2)!.disabled).toBe(true);
  });

  it("are left out for a selection of two, of which one can be played", async () => {
    const items = await getPlaybackContextMenuItems([song, release]);
    expect(items.filter((item) => item.text)).toEqual([]);

    await showPlayMenuForMediaItem([song, release]);
    expect(emittedMenus[0].items.filter((item) => item.text)).toEqual([]);
  });

  it("offer the entry once per instance, each named under it", async () => {
    apiMock.providers = {
      ...apiMock.providers,
      "demo--2": instance("demo--2"),
    };

    const items = await getPlaybackContextMenuItems([song]);

    expect(
      items
        .filter((item) => item.text)
        .map((item) => [item.text, item.addedBy]),
    ).toEqual([
      ["Send to the frame", "Demo demo"],
      ["Send to the frame", "Demo demo--2"],
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

/** The menu of a media item, as it opens. */
async function itemMenu(items: MediaItemType[]) {
  await showContextMenuForMediaItem(items);
  return emittedMenus.at(-1)!.items;
}

async function choose(items: ContextMenuItem[], text: string) {
  items.find((item) => item.text === text)!.action!();
  await flushPromises();
}
