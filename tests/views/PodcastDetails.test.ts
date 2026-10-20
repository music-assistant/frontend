import type { MusicAssistantApi } from "@/plugins/api";
import type { LoadDataParams } from "@/composables/useItemsListing";
import type {
  ListingType,
  PodcastEpisode,
  SortDirection,
  SortField,
} from "@/plugins/api/interfaces";
import PodcastDetails from "@/views/PodcastDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { podcast } from "../fixtures/podcast";
import { podcastEpisode } from "../fixtures/podcastEpisode";

const { mockGetPodcast, mockGetPodcastEpisodes, mockSubscribe, mockStore } =
  vi.hoisted(() => ({
    mockGetPodcast: vi.fn<MusicAssistantApi["getPodcast"]>(),
    mockGetPodcastEpisodes: vi.fn<MusicAssistantApi["getPodcastEpisodes"]>(),
    mockSubscribe: vi.fn(() => () => {}),
    mockStore: {
      currentUser: undefined as
        { preferences: Record<string, unknown> } | undefined,
    },
  }));

vi.mock("@/plugins/api", () => ({
  api: {
    getPodcast: mockGetPodcast,
    getPodcastEpisodes: mockGetPodcastEpisodes,
    subscribe: mockSubscribe,
  },
}));
vi.mock("@/plugins/store", () => ({ store: mockStore }));

vi.mock("@/components/podcast/PodcastHero.vue", () => ({
  default: {
    name: "PodcastHero",
    props: ["item", "backdrop", "blurBackdrop", "episodeCount"],
    emits: ["edit-rows"],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/details/DetailAdminCard.vue", () => ({
  default: {
    name: "DetailAdminCard",
    template: '<div data-row="provider_mappings" />',
  },
}));
vi.mock("@/components/details/DetailTextRow.vue", () => ({
  default: {
    name: "DetailTextRow",
    emits: ["edit-rows"],
    template: '<div data-row="about" />',
  },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: { name: "ProviderDetails", template: "<div />" },
}));
// never calls the listing callback itself, like a listing restoring its previous episodes
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["parentItem", "loadPagedData", "path", "sortListing"],
    template: '<div data-listing data-row="episodes" />',
  },
}));
vi.mock("@/components/details/RowsEditor.vue", () => ({
  default: {
    name: "RowsEditor",
    props: ["open", "item", "registry", "availableIds", "rowMeta", "subtitle"],
    emits: ["update:open"],
    template: "<div data-rows-editor />",
  },
}));

const LIBRARY_SHOW = podcast({
  item_id: "7",
  provider: "library",
  total_episodes: 99,
  metadata: { description: "About the show" },
});
const EPISODES = [1, 2, 3].map((position) =>
  podcastEpisode({ item_id: `ep${position}`, position }),
);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

async function mountDetails() {
  const wrapper = mount(PodcastDetails, {
    props: { itemId: "abc", provider: "rss" },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function hero(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "PodcastHero" });
}

function listing(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "ItemsListing" });
}

function loadEpisodes(wrapper: VueWrapper, params: LoadDataParams) {
  const loadPagedData = listing(wrapper).props("loadPagedData") as (
    params: LoadDataParams,
  ) => Promise<PodcastEpisode[]>;
  return loadPagedData(params);
}

function editor(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "RowsEditor" });
}

function renderedRows(wrapper: VueWrapper) {
  return wrapper.findAll("[data-row]").map((row) => row.attributes("data-row"));
}

describe("PodcastDetails", () => {
  beforeEach(() => {
    mockGetPodcast.mockReset().mockResolvedValue(LIBRARY_SHOW);
    mockGetPodcastEpisodes.mockReset().mockResolvedValue(EPISODES);
    mockSubscribe.mockReset().mockReturnValue(() => {});
    mockStore.currentUser = undefined;
  });

  it("renders the rows in their default order", async () => {
    const wrapper = await mountDetails();

    expect(renderedRows(wrapper)).toEqual([
      "about",
      "episodes",
      "provider_mappings",
    ]);
  });

  it("follows the user's saved row order and hidden rows", async () => {
    mockStore.currentUser = {
      preferences: {
        "podcast.rows": {
          order: ["provider_mappings", "episodes", "about"],
          hidden: ["about"],
        },
      },
    };

    const wrapper = await mountDetails();

    expect(renderedRows(wrapper)).toEqual(["provider_mappings", "episodes"]);
  });

  it("opens the rows editor from the hero and the about row", async () => {
    const wrapper = await mountDetails();
    expect(editor(wrapper).props("open")).toBe(false);

    hero(wrapper).vm.$emit("edit-rows");
    await flushPromises();
    expect(editor(wrapper).props("open")).toBe(true);

    editor(wrapper).vm.$emit("update:open", false);
    wrapper.findComponent({ name: "DetailTextRow" }).vm.$emit("edit-rows");
    await flushPromises();
    expect(editor(wrapper).props("open")).toBe(true);
  });

  it("hands the editor the podcast rows and the episode count", async () => {
    const wrapper = await mountDetails();

    expect(editor(wrapper).props("availableIds")).toEqual([
      "about",
      "episodes",
      "provider_mappings",
    ]);
    expect(editor(wrapper).props("subtitle")).toBe(
      "Applies to every podcast page",
    );
    expect(editor(wrapper).props("rowMeta").episodes).toBe("3 episodes");
  });

  it("closes the rows editor when another podcast opens", async () => {
    const wrapper = await mountDetails();
    hero(wrapper).vm.$emit("edit-rows");
    await flushPromises();

    await wrapper.setProps({ itemId: "def" });
    await flushPromises();

    expect(editor(wrapper).props("open")).toBe(false);
  });

  it("shares the list settings of a library podcast with its episode pages", async () => {
    const wrapper = await mountDetails();

    expect(listing(wrapper).props("path")).toBe("podcast.7.library");
  });

  it("counts every episode for the hero without the listing loading them", async () => {
    const episodes = deferred<PodcastEpisode[]>();
    mockGetPodcastEpisodes.mockReturnValue(episodes.promise);

    const wrapper = await mountDetails();
    expect(hero(wrapper).props("episodeCount")).toBeUndefined();
    expect(mockGetPodcastEpisodes).toHaveBeenCalledWith(
      "abc",
      "rss",
      undefined,
      undefined,
      0,
    );

    episodes.resolve(EPISODES);
    await flushPromises();
    expect(hero(wrapper).props("episodeCount")).toBe(EPISODES.length);
  });

  it("loads episode pages with the server-side played filter and sort", async () => {
    const wrapper = await mountDetails();
    mockGetPodcastEpisodes.mockClear();
    await loadEpisodes(wrapper, {
      offset: 40,
      limit: 20,
      sortBy: "name",
      sortField: "name" as SortField,
      sortDirection: "asc" as SortDirection,
      search: "interview",
      hideFullyPlayed: true,
    });

    expect(listing(wrapper).props("sortListing")).toBe(
      "podcast_episodes" as ListingType,
    );
    expect(mockGetPodcastEpisodes).toHaveBeenCalledWith(
      "abc",
      "rss",
      false,
      "interview",
      20,
      40,
      "name",
      "asc",
    );
    expect(mockGetPodcastEpisodes).toHaveBeenCalledTimes(1);
  });

  it("counts the episodes again when the listing refreshes", async () => {
    const wrapper = await mountDetails();
    const params: LoadDataParams = {
      offset: 0,
      limit: 20,
      sortBy: "position:desc",
      search: "",
    };
    await loadEpisodes(wrapper, params);
    const newEpisode = podcastEpisode({ item_id: "ep4", position: 4 });
    mockGetPodcastEpisodes
      .mockClear()
      .mockResolvedValue([...EPISODES, newEpisode]);

    await loadEpisodes(wrapper, { ...params, refresh: true });
    await flushPromises();

    expect(mockGetPodcastEpisodes).toHaveBeenCalledTimes(2);
    expect(hero(wrapper).props("episodeCount")).toBe(EPISODES.length + 1);
  });

  it("clears the count when another podcast opens", async () => {
    const wrapper = await mountDetails();
    expect(hero(wrapper).props("episodeCount")).toBe(EPISODES.length);
    mockGetPodcastEpisodes.mockReturnValue(new Promise(() => {}));

    await wrapper.setProps({ itemId: "def" });

    expect(hero(wrapper).props("episodeCount")).toBeUndefined();
  });

  it("ignores a late episode reply of the previous podcast", async () => {
    const previous = deferred<PodcastEpisode[]>();
    const current = deferred<PodcastEpisode[]>();
    mockGetPodcastEpisodes
      .mockReturnValueOnce(previous.promise)
      .mockReturnValueOnce(current.promise);
    const wrapper = await mountDetails();

    await wrapper.setProps({ itemId: "def" });
    previous.resolve(EPISODES);
    await flushPromises();
    expect(hero(wrapper).props("episodeCount")).toBeUndefined();

    current.resolve(EPISODES.slice(0, 2));
    await flushPromises();
    expect(hero(wrapper).props("episodeCount")).toBe(2);
  });

  it("keeps the newest count when an older count finishes last", async () => {
    const first = deferred<PodcastEpisode[]>();
    const second = deferred<PodcastEpisode[]>();
    mockGetPodcastEpisodes
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const wrapper = await mountDetails();
    await loadEpisodes(wrapper, {
      offset: 0,
      limit: 20,
      sortBy: "position:desc",
      search: "",
      refresh: true,
    });

    second.resolve([
      ...EPISODES,
      podcastEpisode({ item_id: "ep4", position: 4 }),
    ]);
    await flushPromises();
    first.resolve(EPISODES);
    await flushPromises();

    expect(hero(wrapper).props("episodeCount")).toBe(EPISODES.length + 1);
  });
});
