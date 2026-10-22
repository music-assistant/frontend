import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  type EventMessage,
  ListingType,
  type Playlist,
  type Scope,
  SortDirection,
  SortField,
  type SmartPlaylistRules,
  type Track,
  type User,
} from "@/plugins/api/interfaces";
import PlaylistDetails from "@/views/PlaylistDetails.vue";
import type { LoadDataParams } from "@/composables/useItemsListing";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { track } from "../fixtures/track";
import { user } from "../fixtures/user";

const { apiMock, authMock, storeMock, eventbusMock } = vi.hoisted(() => ({
  apiMock: {
    getPlaylist: vi.fn<MusicAssistantApi["getPlaylist"]>(),
    getPlaylistTracks: vi.fn<MusicAssistantApi["getPlaylistTracks"]>(),
    getSmartPlaylistRules: vi.fn<MusicAssistantApi["getSmartPlaylistRules"]>(),
    subscribe: vi.fn(() => () => {}),
  },
  authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  storeMock: { currentUser: undefined as User | undefined },
  eventbusMock: { emit: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
// the hero translates in its script, so the keys are what its labels read
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

// the hero only has to hand through the actions it puts in its toolbar
vi.mock("@/components/details/DetailHero.vue", () => ({
  default: {
    name: "DetailHero",
    template: '<div><slot name="toolbar-append" /></div>',
  },
}));
vi.mock("@/components/details/DetailHeroFavorite.vue", () => ({
  default: { name: "DetailHeroFavorite", template: "<div />" },
}));
vi.mock("@/components/details/RowsEditor.vue", () => ({
  default: {
    name: "RowsEditor",
    props: ["availableIds"],
    template: "<div />",
  },
}));
vi.mock("@/components/playlist/PlaylistFeaturedArtists.vue", () => ({
  default: {
    name: "PlaylistFeaturedArtists",
    props: ["tracks"],
    template: "<div />",
  },
}));
// the rest of the page is irrelevant to the actions, so keep the stubs bare
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["loadPagedData", "sortListing"],
    // the order the listing shows its tracks in
    data: () => ({ sortField: "artist_name", sortDirection: "desc" }),
    template: "<div />",
  },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: { name: "ProviderDetails", template: "<div />" },
}));
vi.mock("@/components/DynamicItemSample.vue", () => ({
  default: { name: "DynamicItemSample", template: "<div />" },
}));
vi.mock("@/components/PlaylistAccessSummary.vue", () => ({
  default: { name: "PlaylistAccessSummary", template: "<div />" },
}));
vi.mock("@/components/smart_playlist/SmartPlaylistRulesView.vue", () => ({
  default: { name: "SmartPlaylistRulesView", template: "<div />" },
}));
vi.mock("@/layouts/default/EditSmartPlaylistDialog.vue", () => ({
  default: { name: "EditSmartPlaylistDialog", template: "<div />" },
}));

const rules: SmartPlaylistRules = {
  genre_ids: [],
  artist_ids: [],
  album_ids: [],
  favorites_only: false,
  logic: "AND",
  limit: 50,
};

// the rules action belongs to a smart playlist, sharing to a playlist
// Music Assistant keeps itself
const playlistOf = (providerDomain: string): Playlist =>
  playlist({
    provider_mappings: [providerMapping({ provider_domain: providerDomain })],
  });

async function mountDetails(item: Playlist) {
  apiMock.getPlaylist.mockResolvedValue(item);
  const wrapper = mount(PlaylistDetails, {
    props: { itemId: item.item_id, provider: item.provider },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

describe("PlaylistDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.subscribe.mockReturnValue(() => {});
    apiMock.getPlaylistTracks.mockResolvedValue([]);
    apiMock.getSmartPlaylistRules.mockResolvedValue(rules);
    // a library manager may edit the rules and share the playlist
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    storeMock.currentUser = user();
  });

  it("renders the edit-rules action of a smart playlist as a labelled button", async () => {
    const wrapper = await mountDetails(playlistOf("smart_playlist"));

    const editButton = wrapper.find(
      'button[aria-label="smart_playlist.edit_rules"]',
    );
    expect(editButton.exists()).toBe(true);
    expect(editButton.attributes("type")).toBe("button");
  });

  it("renders the share action as a labelled button that opens the access dialog", async () => {
    const item = playlistOf("builtin");
    const wrapper = await mountDetails(item);

    const shareButton = wrapper.find('button[aria-label="share_playlist"]');
    expect(shareButton.exists()).toBe(true);
    expect(shareButton.attributes("type")).toBe("button");

    await shareButton.trigger("click");
    expect(eventbusMock.emit).toHaveBeenCalledWith("playlistAccessDialog", {
      playlist: item,
    });
  });

  it("hands the hero's play button the order the track listing shows", async () => {
    const wrapper = await mountDetails(playlistOf("builtin"));

    const hero = wrapper.findComponent({ name: "PlaylistHero" });
    expect(hero.props("tracksSortField")).toBe("artist_name");
    expect(hero.props("tracksSortDirection")).toBe("desc");
  });

  it("loads playlist tracks through the server-paged listing API", async () => {
    const item = playlistOf("builtin");
    const wrapper = await mountDetails(item);
    const listing = wrapper.findComponent({ name: "ItemsListing" });
    const loadPagedData = listing.props("loadPagedData") as (
      params: LoadDataParams,
    ) => Promise<unknown[]>;
    const params: LoadDataParams = {
      offset: 40,
      limit: 20,
      sortBy: "name",
      sortField: "name" as SortField,
      sortDirection: "asc" as SortDirection,
      search: "live",
    };

    await loadPagedData(params);

    expect(listing.props("sortListing")).toBe("playlist_tracks" as ListingType);
    expect(apiMock.getPlaylistTracks).toHaveBeenCalledWith(
      item.item_id,
      item.provider,
      false,
      undefined,
      "live",
      20,
      40,
      "name",
      "asc",
    );
  });

  it("refreshes the shared track snapshot when the listing refreshes", async () => {
    const initialTracks = [track({ name: "Initial track" })];
    const refreshedTracks = [track({ name: "Updated track" })];
    apiMock.getPlaylistTracks.mockResolvedValue(initialTracks);
    const item = playlistOf("builtin");
    const wrapper = await mountDetails(item);
    let resolveRefresh!: (items: Track[]) => void;
    apiMock.getPlaylistTracks
      .mockClear()
      .mockImplementationOnce(
        () =>
          new Promise<Track[]>((resolve) => {
            resolveRefresh = resolve;
          }),
      )
      .mockResolvedValue(refreshedTracks);

    const loadPagedData = wrapper
      .findComponent({ name: "ItemsListing" })
      .props("loadPagedData") as (params: LoadDataParams) => Promise<unknown[]>;
    const refreshing = loadPagedData({
      offset: 0,
      limit: 50,
      sortBy: "position",
      search: "",
      refresh: true,
    });
    await flushPromises();

    expect(apiMock.getPlaylistTracks).toHaveBeenCalledTimes(1);
    resolveRefresh(refreshedTracks);
    await refreshing;
    await flushPromises();

    expect(apiMock.getPlaylistTracks).toHaveBeenCalledTimes(2);
    expect(apiMock.getPlaylistTracks).toHaveBeenCalledWith(
      item.item_id,
      item.provider,
      true,
      undefined,
      undefined,
      0,
    );
    expect(apiMock.getPlaylistTracks).toHaveBeenNthCalledWith(
      2,
      item.item_id,
      item.provider,
      false,
      undefined,
      "",
      50,
      0,
      undefined,
      undefined,
    );
    expect(
      wrapper
        .findComponent({ name: "PlaylistFeaturedArtists" })
        .props("tracks"),
    ).toEqual(refreshedTracks);
  });

  it("retries a failed snapshot refresh before reloading the page", async () => {
    const refreshedTracks = [track({ name: "Updated track" })];
    apiMock.getPlaylistTracks.mockResolvedValue([
      track({ name: "Initial track" }),
    ]);
    const item = playlistOf("builtin");
    const wrapper = await mountDetails(item);
    apiMock.getPlaylistTracks
      .mockClear()
      .mockRejectedValueOnce(new Error("snapshot refresh failed"))
      .mockResolvedValueOnce(refreshedTracks)
      .mockResolvedValueOnce(refreshedTracks);
    const loadPagedData = wrapper
      .findComponent({ name: "ItemsListing" })
      .props("loadPagedData") as (params: LoadDataParams) => Promise<unknown[]>;
    const params: LoadDataParams = {
      offset: 0,
      limit: 50,
      sortBy: "position",
      search: "",
      refresh: true,
    };

    await expect(loadPagedData(params)).rejects.toThrow(
      "snapshot refresh failed",
    );
    await loadPagedData({ ...params, refresh: false });

    expect(apiMock.getPlaylistTracks).toHaveBeenNthCalledWith(
      1,
      item.item_id,
      item.provider,
      true,
      undefined,
      undefined,
      0,
    );
    expect(apiMock.getPlaylistTracks).toHaveBeenNthCalledWith(
      2,
      item.item_id,
      item.provider,
      true,
      undefined,
      undefined,
      0,
    );
    expect(apiMock.getPlaylistTracks).toHaveBeenNthCalledWith(
      3,
      item.item_id,
      item.provider,
      false,
      undefined,
      "",
      50,
      0,
      undefined,
      undefined,
    );
    expect(
      wrapper
        .findComponent({ name: "PlaylistFeaturedArtists" })
        .props("tracks"),
    ).toEqual(refreshedTracks);
  });

  it("keeps a newer playlist refresh pending when the previous playlist resolves late", async () => {
    const firstItem = playlist({
      ...playlistOf("builtin"),
      item_id: "playlist-a",
    });
    const secondItem = playlist({
      ...playlistOf("builtin"),
      item_id: "playlist-b",
    });
    apiMock.getPlaylist.mockImplementation(async (itemId) =>
      itemId === firstItem.item_id ? firstItem : secondItem,
    );
    const wrapper = await mountDetails(firstItem);
    let resolveFirstRefresh!: (items: Track[]) => void;
    let rejectSecondRefresh!: (error: Error) => void;
    let secondRefreshAttempts = 0;
    const refreshedTracks = [track({ name: "Playlist B track" })];
    apiMock.getPlaylistTracks
      .mockClear()
      .mockImplementation((itemId, _provider, refresh) => {
        if (itemId === firstItem.item_id && refresh) {
          return new Promise<Track[]>((resolve) => {
            resolveFirstRefresh = resolve;
          });
        }
        if (itemId === secondItem.item_id && refresh) {
          secondRefreshAttempts += 1;
          if (secondRefreshAttempts === 1) {
            return new Promise<Track[]>((_resolve, reject) => {
              rejectSecondRefresh = reject;
            });
          }
          return Promise.resolve(refreshedTracks);
        }
        return Promise.resolve([]);
      });
    const loadPagedData = wrapper
      .findComponent({ name: "ItemsListing" })
      .props("loadPagedData") as (params: LoadDataParams) => Promise<unknown[]>;

    const firstRequest = loadPagedData({
      offset: 0,
      limit: 50,
      sortBy: "position",
      search: "",
      refresh: true,
    });
    await wrapper.setProps({ itemId: secondItem.item_id });
    await flushPromises();
    const secondRequest = loadPagedData({
      offset: 0,
      limit: 50,
      sortBy: "position",
      search: "",
      refresh: true,
    });

    resolveFirstRefresh([]);
    await firstRequest;
    rejectSecondRefresh(new Error("playlist B refresh failed"));
    await expect(secondRequest).rejects.toThrow("playlist B refresh failed");

    await loadPagedData({
      offset: 0,
      limit: 50,
      sortBy: "position",
      search: "",
      refresh: false,
    });

    expect(secondRefreshAttempts).toBe(2);
    expect(
      wrapper
        .findComponent({ name: "PlaylistFeaturedArtists" })
        .props("tracks"),
    ).toEqual(refreshedTracks);
  });

  it("leaves featured artists out of a dynamic playlist's rows", async () => {
    const wrapper = await mountDetails(
      playlist({ ...playlistOf("builtin"), is_dynamic: true }),
    );

    const rows = wrapper
      .findComponent({ name: "RowsEditor" })
      .props("availableIds") as string[];
    expect(rows).not.toContain("featured_artists");
    expect(rows).toContain("tracks");
  });

  // the listing is a stub that never loads, as when it restores its tracks
  // from a previous visit of the playlist
  it("loads the tracks for the page even when the listing does not", async () => {
    const tracks = [track()];
    apiMock.getPlaylistTracks.mockResolvedValue(tracks);
    const item = playlistOf("builtin");
    const wrapper = await mountDetails(item);

    expect(apiMock.getPlaylistTracks).toHaveBeenCalledWith(
      item.item_id,
      item.provider,
      false,
      undefined,
      undefined,
      0,
    );
    expect(
      wrapper
        .findComponent({ name: "PlaylistFeaturedArtists" })
        .props("tracks"),
    ).toEqual(tracks);
  });

  it.each([true, false])(
    "refreshes the snapshot on updates with tracks hidden: %s",
    async (hidden) => {
      const onUpdated: Array<(evt: EventMessage) => void> = [];
      apiMock.subscribe.mockImplementation(((
        type: EventType,
        callback: (evt: EventMessage) => void,
      ) => {
        if (type === EventType.MEDIA_ITEM_UPDATED) onUpdated.push(callback);
        return () => {};
      }) as never);
      storeMock.currentUser = user({
        preferences: { "playlist.rows": { hidden: hidden ? ["tracks"] : [] } },
      });
      const item = playlistOf("builtin");
      const wrapper = await mountDetails(item);
      expect(wrapper.findComponent({ name: "ItemsListing" }).exists()).toBe(
        !hidden,
      );
      const refreshedTracks = [track({ name: "Updated track" })];
      apiMock.getPlaylistTracks.mockClear().mockResolvedValue(refreshedTracks);

      onUpdated.forEach((callback) =>
        callback({ data: { ...item, name: "Renamed" } } as EventMessage),
      );
      await flushPromises();

      expect(apiMock.getPlaylistTracks).toHaveBeenCalledWith(
        item.item_id,
        item.provider,
        true,
        undefined,
        undefined,
        0,
      );
      expect(
        wrapper
          .findComponent({ name: "PlaylistFeaturedArtists" })
          .props("tracks"),
      ).toEqual(refreshedTracks);
    },
  );
});
