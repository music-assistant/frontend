/**
 * A library item none of the music services has any more (a source that was
 * removed, a track a service pulled) can be looked up on them again from its
 * context menu, which is the server's refresh with a substitute search.
 */
import { showContextMenuForMediaItem } from "@/layouts/default/ItemContextMenu.vue";
import type { ContextMenuDialogEvent } from "@/plugins/eventbus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtistType } from "@/plugins/api/interfaces";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, emittedMenus, hasScope, routerMock, storeMock, toastMock } =
  vi.hoisted(() => ({
    emittedMenus: [] as ContextMenuDialogEvent[],
    apiMock: {
      getItem: vi.fn(),
      getLibraryItem: vi.fn(),
      getProvider: vi.fn(),
      getCoreConfigValue: vi.fn(),
      refreshItem: vi.fn(),
      signalEvent: vi.fn(),
      getProviderName: vi.fn(),
      playMedia: vi.fn(),
      providers: {},
      players: {},
    },
    hasScope: vi.fn(),
    routerMock: { push: vi.fn() },
    toastMock: {
      success: vi.fn(),
      error: vi.fn(),
      loading: vi.fn(() => "searching"),
      dismiss: vi.fn(),
    },
    storeMock: {
      activePlayer: undefined,
      activePlayerId: undefined,
      enabledPlugins: new Set<string>(),
    },
  }));

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
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/router", () => ({ default: routerMock }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

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
  emittedMenus.length = 0;
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

  it("shows a spinner while the music services are searched", async () => {
    await showContextMenuForMediaItem(gone, undefined, 0, 0, true, true);

    await emittedMenus[0].items
      .find((entry) => entry.label === "find_on_music_services")
      ?.action?.();

    expect(toastMock.loading).toHaveBeenCalledWith(
      "finding_on_music_services",
      {
        duration: Infinity,
      },
    );
    expect(toastMock.dismiss).toHaveBeenCalledWith("searching");
  });

  it("removes the spinner when the search fails", async () => {
    apiMock.refreshItem.mockRejectedValue(new Error("not found"));
    await showContextMenuForMediaItem(gone, undefined, 0, 0, true, true);

    await expect(
      emittedMenus[0].items
        .find((entry) => entry.label === "find_on_music_services")
        ?.action?.(),
    ).rejects.toThrow("not found");

    expect(toastMock.dismiss).toHaveBeenCalledWith("searching");
  });

  it("opens the copy another music service has", async () => {
    const copy = album({ item_id: "abc", provider: "spotify--1" });
    apiMock.refreshItem.mockResolvedValue(copy);
    apiMock.getProviderName.mockReturnValue("Spotify");
    await showContextMenuForMediaItem(gone, undefined, 0, 0, true, true);

    await emittedMenus[0].items
      .find((entry) => entry.label === "find_on_music_services")
      ?.action?.();

    expect(apiMock.getProviderName).toHaveBeenCalledWith("spotify--1");
    expect(toastMock.success).toHaveBeenCalledWith("found_on_provider");
    expect(routerMock.push).toHaveBeenCalledWith({
      name: "album",
      params: { itemId: "abc", provider: "spotify--1" },
    });
    expect(apiMock.signalEvent).not.toHaveBeenCalled();
  });

  it("opens an author found on another service on the author's page", async () => {
    const goneAuthor = artist({
      artist_type: ArtistType.AUTHOR,
      provider_mappings: [
        providerMapping({ provider_instance: "tidal--gone", in_library: true }),
      ],
    });
    const copy = artist({
      item_id: "abc",
      provider: "audible--1",
      artist_type: ArtistType.AUTHOR,
    });
    apiMock.getLibraryItem.mockResolvedValue(goneAuthor);
    apiMock.refreshItem.mockResolvedValue(copy);
    await showContextMenuForMediaItem(goneAuthor, undefined, 0, 0, true, true);

    await emittedMenus[0].items
      .find((entry) => entry.label === "find_on_music_services")
      ?.action?.();

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "audiobookartist",
      params: { itemId: "abc", provider: "audible--1", role: "authors" },
    });
  });

  it("updates the open views when a library merge returns another item", async () => {
    const merged = album({ item_id: "2" });
    apiMock.refreshItem.mockResolvedValue(merged);
    await showContextMenuForMediaItem(gone, undefined, 0, 0, true, true);

    await emittedMenus[0].items
      .find((entry) => entry.label === "find_on_music_services")
      ?.action?.();

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(apiMock.signalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ object_id: merged.uri, data: merged }),
    );
  });

  it("updates the open views when the item itself comes back", async () => {
    apiMock.refreshItem.mockResolvedValue(gone);
    await showContextMenuForMediaItem(gone, undefined, 0, 0, true, true);

    await emittedMenus[0].items
      .find((entry) => entry.label === "find_on_music_services")
      ?.action?.();

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(apiMock.signalEvent).toHaveBeenCalledWith(
      expect.objectContaining({ object_id: gone.uri, data: gone }),
    );
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
