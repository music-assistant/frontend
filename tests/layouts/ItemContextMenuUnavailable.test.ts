/**
 * A library item none of the music services has any more (a source that was
 * removed, a track a service pulled) can be looked up on them again from its
 * context menu, which is the server's refresh with a substitute search.
 */
import { showContextMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { playlist } from "../fixtures/playlist";
import { track } from "../fixtures/track";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, emittedMenus, routerMock, toastMock, hasScope, storeMock } =
  vi.hoisted(() => ({
    emittedMenus: [] as ContextMenuDialogEvent[],
    routerMock: {
      push: vi.fn(),
      currentRoute: { value: { fullPath: "/share" } },
    },
    toastMock: {
      error: vi.fn(),
      loading: vi.fn(() => "search-toast"),
      dismiss: vi.fn(),
      success: vi.fn(),
    },
    apiMock: {
      getItem: vi.fn(),
      getLibraryItem: vi.fn(),
      getProvider: vi.fn(),
      getCoreConfigValue: vi.fn(),
      refreshItem: vi.fn(),
      signalEvent: vi.fn(),
      playMedia: vi.fn(),
      resolveSharedItem: vi.fn(),
      providers: {},
      players: {},
    },
    hasScope: vi.fn(),
    storeMock: {
      activePlayer: undefined,
      activePlayerId: undefined,
      enabledPlugins: new Set<string>(),
    },
  }));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/router", () => ({ default: routerMock }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn((type: string, payload: ContextMenuDialogEvent) => {
      if (type === "contextmenu")
        emittedMenus.push(payload as ContextMenuDialogEvent);
    }),
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// a library album whose only source is gone: the mapping's provider is not loaded
const gone = album({
  item_id: "1",
  provider_mappings: [
    providerMapping({ provider_instance: "tidal--gone", in_library: true }),
  ],
});

/** The entries of the item's menu; none when there is nothing to offer at all. */
async function offeredLabels(): Promise<string[]> {
  await showContextMenuForMediaItem(gone, undefined, 0, 0, true, true);
  return emittedMenus[0]?.items.map((entry) => entry.label) ?? [];
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getLibraryItem.mockResolvedValue(gone);
  apiMock.refreshItem.mockResolvedValue(undefined);
  hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  routerMock.currentRoute.value.fullPath = "/share";
  emittedMenus.length = 0;
  apiMock.resolveSharedItem.mockResolvedValue(null);
});

describe("the context menu of an unavailable library item", () => {
  it("lets a member look it up on the music services", async () => {
    const labels = await offeredLabels();

    expect(labels).toContain("find_on_music_services");
    expect(labels).not.toContain("refresh_item");
  });

  it("runs the server's refresh with its substitute search", async () => {
    await showContextMenuForMediaItem(gone, undefined, 0, 0, true, true);

    await emittedMenus[0].items
      .find((entry) => entry.label === "find_on_music_services")
      ?.action?.();

    expect(apiMock.refreshItem).toHaveBeenCalledWith(gone);
  });

  it("lets an admin look it up as well", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    expect(await offeredLabels()).toContain("find_on_music_services");
  });

  it("keeps it out of playlists and shortcuts", async () => {
    const labels = await offeredLabels();

    expect(labels).not.toContain("add_playlist");
    expect(labels).not.toContain("shortcut.add_to");
  });

  it("offers a guest nothing", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.guest));

    expect(await offeredLabels()).not.toContain("find_on_music_services");
  });
});

describe("the context menu of an unresolved shared track", () => {
  const preview = track({
    provider: "builtin",
    item_id: "share-preview://track/encoded",
    provider_mappings: [],
  });

  async function searchAction() {
    await showContextMenuForMediaItem(preview);
    expect(emittedMenus[0].items.map((entry) => entry.label)).toEqual([
      "share.search_track",
    ]);
    return emittedMenus[0].items[0].action;
  }

  it("searches immediately and opens the matched track with feedback", async () => {
    const matched = track({ item_id: "matched" });
    apiMock.resolveSharedItem.mockResolvedValue(matched);
    const action = await searchAction();

    const request = action?.();

    expect(apiMock.resolveSharedItem).toHaveBeenCalledWith("encoded", true);
    expect(toastMock.loading).toHaveBeenCalledWith("share.loading", {
      duration: Infinity,
    });
    await request;

    expect(toastMock.dismiss).toHaveBeenCalledWith("search-toast");
    expect(toastMock.success).toHaveBeenCalledWith("share.resolve_success");
    expect(routerMock.push).toHaveBeenCalledWith({
      name: "track",
      params: { provider: "library", itemId: "matched" },
    });
    expect(apiMock.getLibraryItem).not.toHaveBeenCalled();
    expect(apiMock.playMedia).not.toHaveBeenCalled();
  });

  it("keeps normal playlist removal for imported unresolved tracks", async () => {
    const imported = track({
      provider: "builtin",
      item_id: "share://track/0",
      provider_mappings: [],
    });
    const parent = playlist({ item_id: "imported", is_editable: true });
    apiMock.getLibraryItem.mockResolvedValue(imported);
    await showContextMenuForMediaItem(imported, parent, 0, 0, true, true);
    const labels = emittedMenus[0].items.map((entry) => entry.label);

    expect(labels).not.toContain("share.search_track");
    expect(labels).toContain("remove_playlist");
  });

  it("ignores a late search response after leaving and returning to the same route", async () => {
    let resolveRequest!: (value: ReturnType<typeof track> | null) => void;
    const pending = new Promise<ReturnType<typeof track> | null>((resolve) => {
      resolveRequest = resolve;
    });
    apiMock.resolveSharedItem.mockReturnValueOnce(pending);
    const action = await searchAction();
    const request = action?.();
    routerMock.currentRoute.value = { fullPath: "/playlist/other" };
    routerMock.currentRoute.value = { fullPath: "/share" };
    resolveRequest(track({ item_id: "matched" }));
    await request;

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.dismiss).toHaveBeenCalledWith("search-toast");
  });

  it.each([false, true])(
    "reports failed search without opening details (error: %s)",
    async (requestFails) => {
      if (requestFails)
        apiMock.resolveSharedItem.mockRejectedValue(new Error("offline"));
      else apiMock.resolveSharedItem.mockResolvedValue(null);
      const action = await searchAction();
      await action?.();
      expect(toastMock.dismiss).toHaveBeenCalledWith("search-toast");
      expect(toastMock.error).toHaveBeenCalledWith("share.resolve_failed");
      expect(routerMock.push).not.toHaveBeenCalled();
    },
  );
});
