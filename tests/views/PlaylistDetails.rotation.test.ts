import { ROTATION_PROVIDER_DOMAIN } from "@/components/rotation/constants";
import type { MusicAssistantApi } from "@/plugins/api";
import type { Playlist, Scope, User } from "@/plugins/api/interfaces";
import PlaylistDetails from "@/views/PlaylistDetails.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const { apiMock, authMock, storeMock, routerMock, toastMock } = vi.hoisted(
  () => ({
    apiMock: {
      getPlaylist: vi.fn<MusicAssistantApi["getPlaylist"]>(),
      getPlaylistTracks: vi.fn<MusicAssistantApi["getPlaylistTracks"]>(),
      getSmartPlaylistRules:
        vi.fn<MusicAssistantApi["getSmartPlaylistRules"]>(),
      subscribe: vi.fn(() => () => {}),
    },
    authMock: { hasScope: vi.fn<(scope: Scope) => boolean>() },
    storeMock: {
      currentUser: undefined as User | undefined,
      enabledPlugins: new Set<string>(),
    },
    routerMock: { push: vi.fn() },
    toastMock: { error: vi.fn(), success: vi.fn() },
  }),
);

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => routerMock,
}));
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
  default: { name: "RowsEditor", props: ["availableIds"], template: "<div />" },
}));
vi.mock("@/components/playlist/PlaylistFeaturedArtists.vue", () => ({
  default: { name: "PlaylistFeaturedArtists", template: "<div />" },
}));
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
  default: {
    name: "EditSmartPlaylistDialog",
    props: ["open"],
    template: "<div />",
  },
}));

const EDIT_ROTATION = 'button[aria-label="rotation.edit"]';
const EDIT_RULES = 'button[aria-label="smart_playlist.edit_rules"]';

const playlistOf = (providerDomain: string, itemId = "item-1"): Playlist =>
  playlist({
    is_dynamic: true,
    provider_mappings: [
      providerMapping({ provider_domain: providerDomain, item_id: itemId }),
    ],
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

describe("PlaylistDetails Rotation action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getPlaylistTracks.mockResolvedValue([]);
    apiMock.getSmartPlaylistRules.mockResolvedValue({
      genre_ids: [],
      artist_ids: [],
      album_ids: [],
      favorites_only: false,
      logic: "AND",
      limit: 50,
    });
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    storeMock.currentUser = user();
    storeMock.enabledPlugins = new Set([ROTATION_PROVIDER_DOMAIN]);
  });

  it("opens the editor with the id of the Rotation mapping", async () => {
    const wrapper = await mountDetails(
      playlistOf(ROTATION_PROVIDER_DOMAIN, "rotation-42"),
    );

    const button = wrapper.find(EDIT_ROTATION);
    expect(button.exists()).toBe(true);
    await button.trigger("click");
    expect(routerMock.push).toHaveBeenCalledWith({
      name: "rotation-edit",
      params: { rotationId: "rotation-42" },
    });
    expect(wrapper.find(EDIT_RULES).exists()).toBe(false);
  });

  it("hides the action from a user who cannot edit the library", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );
    const wrapper = await mountDetails(playlistOf(ROTATION_PROVIDER_DOMAIN));

    expect(wrapper.find(EDIT_ROTATION).exists()).toBe(false);
  });

  it("keeps the rules action of a smart playlist and adds no Rotation action", async () => {
    const wrapper = await mountDetails(playlistOf("smart_playlist"));

    expect(wrapper.find(EDIT_RULES).exists()).toBe(true);
    expect(wrapper.find(EDIT_ROTATION).exists()).toBe(false);
  });

  it("shows no Rotation action on an ordinary playlist", async () => {
    const wrapper = await mountDetails(playlistOf("builtin"));

    expect(wrapper.find(EDIT_ROTATION).exists()).toBe(false);
  });

  it("sends the empty sample's edit action of a Rotation to the editor", async () => {
    const wrapper = await mountDetails(
      playlistOf(ROTATION_PROVIDER_DOMAIN, "rotation-42"),
    );

    wrapper.findComponent({ name: "DynamicItemSample" }).vm.$emit("edit-rules");

    expect(routerMock.push).toHaveBeenCalledWith({
      name: "rotation-edit",
      params: { rotationId: "rotation-42" },
    });
  });

  it("opens the smart dialog from the sample's edit action of a smart playlist", async () => {
    const wrapper = await mountDetails(playlistOf("smart_playlist"));

    wrapper.findComponent({ name: "DynamicItemSample" }).vm.$emit("edit-rules");
    await flushPromises();

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(
      wrapper.findComponent({ name: "EditSmartPlaylistDialog" }).props("open"),
    ).toBe(true);
  });

  describe("with the Rotations plugin turned off", () => {
    beforeEach(() => {
      storeMock.enabledPlugins = new Set();
    });

    it("hides the Edit Rotation action", async () => {
      const wrapper = await mountDetails(
        playlistOf(ROTATION_PROVIDER_DOMAIN, "rotation-42"),
      );

      expect(wrapper.find(EDIT_ROTATION).exists()).toBe(false);
    });

    it("opens neither the editor nor the smart dialog from the sample", async () => {
      const wrapper = await mountDetails(
        playlistOf(ROTATION_PROVIDER_DOMAIN, "rotation-42"),
      );

      wrapper
        .findComponent({ name: "DynamicItemSample" })
        .vm.$emit("edit-rules");
      await flushPromises();

      expect(routerMock.push).not.toHaveBeenCalled();
      const dialog = wrapper.findComponent({ name: "EditSmartPlaylistDialog" });
      expect(dialog.exists() && dialog.props("open")).toBe(false);
      expect(toastMock.error).toHaveBeenCalledWith("rotation.plugin_disabled");
    });
  });
});
