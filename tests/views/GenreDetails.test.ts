import type { MusicAssistantApi } from "@/plugins/api";
import GenreDetails from "@/views/GenreDetails.vue";
import {
  MediaType,
  RecommendationFolderType,
  type RecommendationFolder,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed } from "vue";
import { genre } from "../fixtures/genre";
import { track } from "../fixtures/track";

const {
  apiMock,
  storeMock,
  updateUserPreferencesMock,
  hasScopeMock,
  pushMock,
} = vi.hoisted(() => ({
  apiMock: {
    getGenre: vi.fn<MusicAssistantApi["getGenre"]>(),
    getLibraryGenres: vi.fn<MusicAssistantApi["getLibraryGenres"]>(),
    getGenreOverviewRows: vi.fn<MusicAssistantApi["getGenreOverviewRows"]>(),
    getGenreTracks: vi.fn<MusicAssistantApi["getGenreTracks"]>(),
  },
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  updateUserPreferencesMock: vi.fn(),
  hasScopeMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: hasScopeMock },
}));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("@/plugins/api/helpers", () => ({
  itemIsAvailable: () => true,
}));
vi.mock("@/composables/userPreferences", () => ({
  updateUserPreferences: updateUserPreferencesMock,
  useUserPreferences: () => ({
    getPreference: (key: string, defaultValue: unknown) =>
      computed(() => storeMock.currentUser?.preferences?.[key] ?? defaultValue),
  }),
}));
vi.mock("@/composables/useDetailItemUpdates", () => ({
  useDetailItemUpdates: vi.fn(),
}));
vi.mock("@/helpers/genre", () => ({
  folderIdToRoute: {},
  genreMediaTypeIconMap: {},
}));
vi.mock("@/helpers/genre_view", () => ({
  applyGenreView: (preferences: Record<string, unknown>, view: string) => ({
    ...preferences,
    genre_detail_view: view,
  }),
  GENRE_VIEW_PREFERENCE: "genre_detail_view",
}));
vi.mock("@/helpers/utils", () => ({
  panelViewItemResponsive: () => 4,
}));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/components/genre/GenreHero.vue", () => ({
  default: {
    name: "GenreHero",
    props: ["item", "editableRows"],
    emits: ["edit-rows"],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/details/DetailTextRow.vue", () => ({
  default: { name: "DetailTextRow", template: "<div />" },
}));
vi.mock("@/components/details/RowsEditor.vue", () => ({
  default: {
    name: "RowsEditor",
    props: ["open", "item", "registry", "availableIds", "subtitle"],
    template: "<div data-rows-editor />",
  },
}));
vi.mock("@/components/genre/GenreAliasManager.vue", () => ({
  default: { name: "GenreAliasManager", template: "<div />" },
}));
vi.mock("@/components/discover/EditorialShelf.vue", () => ({
  default: {
    name: "EditorialShelf",
    props: ["title", "items"],
    template: '<div data-discovery-shelf :data-title="title" />',
  },
}));
vi.mock("@/components/discover/EditorialMediaCard.vue", () => ({
  default: { name: "EditorialMediaCard", template: "<div />" },
}));
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["itemtype", "forcedViewMode"],
    template:
      '<div data-row="listing" :data-itemtype="itemtype" :data-view-mode="forcedViewMode" />',
  },
}));

enableAutoUnmount(afterEach);

const GENRE = genre({ item_id: "42", name: "Jazz" });
const OVERVIEW_FOLDER = {
  item_id: "recommended-tracks",
  provider: "library",
  name: "For you",
  version: "",
  uri: "library://folder/recommended-tracks",
  external_ids: [],
  is_playable: false,
  media_type: MediaType.FOLDER,
  path: "library://folder/recommended-tracks",
  image: null,
  icon: null,
  subtitle: null,
  items: [track()],
  enabled_by_default: true,
  type: RecommendationFolderType.DEFAULT,
  supports_provider_filter: false,
} satisfies RecommendationFolder;

async function mountDetails(
  viewMode: string,
  preferences: Record<string, unknown> = {},
) {
  storeMock.currentUser = {
    preferences: { ...preferences, genre_detail_view: viewMode },
  };
  const wrapper = mount(GenreDetails, {
    props: { itemId: GENRE.item_id, provider: GENRE.provider },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

describe("GenreDetails row preferences", () => {
  beforeEach(() => {
    storeMock.currentUser = { preferences: {} };
    updateUserPreferencesMock.mockReset();
    hasScopeMock.mockReset().mockReturnValue(false);
    pushMock.mockReset();
    apiMock.getGenre.mockReset().mockResolvedValue(GENRE);
    apiMock.getLibraryGenres.mockReset().mockResolvedValue([]);
    apiMock.getGenreOverviewRows
      .mockReset()
      .mockResolvedValue([OVERVIEW_FOLDER]);
    apiMock.getGenreTracks.mockReset().mockResolvedValue([]);
  });

  it.each(["list", "panel"])(
    "applies saved row order and visibility in %s view",
    async (viewMode) => {
      const wrapper = await mountDetails(viewMode, {
        "genre.rows": {
          order: ["tracks", "artists", "albums"],
          hidden: ["albums"],
        },
      });
      const rows = wrapper.findAll("[data-row]");

      expect(rows.map((row) => row.attributes("data-itemtype"))).toEqual([
        "tracks",
        "playlists",
        "podcasts",
        "audiobooks",
        "artists",
      ]);
      expect(rows.map((row) => row.attributes("data-view-mode"))).toEqual(
        Array(5).fill(viewMode),
      );
    },
  );

  it("leaves discovery shelves unaffected by hidden and reordered traditional rows", async () => {
    const wrapper = await mountDetails("discovery", {
      "genre.rows": {
        order: ["tracks", "artists", "albums"],
        hidden: [
          "tracks",
          "artists",
          "albums",
          "playlists",
          "podcasts",
          "audiobooks",
        ],
      },
    });

    expect(
      wrapper
        .findAll("[data-discovery-shelf]")
        .map((shelf) => shelf.attributes("data-title")),
    ).toEqual(["For you"]);
    expect(wrapper.findAll("[data-row]")).toHaveLength(0);
    expect(apiMock.getGenreOverviewRows).toHaveBeenCalledWith("42", "library");
  });
});
