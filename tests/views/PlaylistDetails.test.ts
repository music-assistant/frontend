import type { MusicAssistantApi } from "@/plugins/api";
import type {
  Playlist,
  Scope,
  SmartPlaylistRules,
  User,
} from "@/plugins/api/interfaces";
import PlaylistDetails from "@/views/PlaylistDetails.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const { apiMock, authMock, storeMock, eventbusMock } = vi.hoisted(() => ({
  apiMock: {
    getPlaylist: vi.fn<MusicAssistantApi["getPlaylist"]>(),
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

// the header only has to hand through the actions the view appends to it
vi.mock("@/components/InfoHeader.vue", () => ({
  default: {
    name: "InfoHeader",
    template: '<div><slot name="append-actions" /></div>',
  },
}));
// the rest of the page is irrelevant to the actions, so keep the stubs bare
vi.mock("@/components/ItemsListing.vue", () => ({
  default: { name: "ItemsListing", template: "<div />" },
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
});
