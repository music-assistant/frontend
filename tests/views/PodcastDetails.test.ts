import type { MusicAssistantApi } from "@/plugins/api";
import type { PodcastEpisode } from "@/plugins/api/interfaces";
import PodcastDetails from "@/views/PodcastDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { podcast } from "../fixtures/podcast";
import { podcastEpisode } from "../fixtures/podcastEpisode";

const { mockGetPodcast, mockGetPodcastEpisodes, mockSubscribe } = vi.hoisted(
  () => ({
    mockGetPodcast: vi.fn<MusicAssistantApi["getPodcast"]>(),
    mockGetPodcastEpisodes: vi.fn<MusicAssistantApi["getPodcastEpisodes"]>(),
    mockSubscribe: vi.fn(() => () => {}),
  }),
);

vi.mock("@/plugins/api", () => ({
  api: {
    getPodcast: mockGetPodcast,
    getPodcastEpisodes: mockGetPodcastEpisodes,
    subscribe: mockSubscribe,
  },
}));
vi.mock("@/plugins/store", () => ({ store: { currentUser: undefined } }));

vi.mock("@/components/podcast/PodcastHero.vue", () => ({
  default: {
    name: "PodcastHero",
    props: ["item", "backdrop", "blurBackdrop", "episodeCount"],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/details/DetailAdminCard.vue", () => ({
  default: { name: "DetailAdminCard", template: "<div />" },
}));
vi.mock("@/components/details/DetailTextRow.vue", () => ({
  default: { name: "DetailTextRow", template: "<div />" },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: { name: "ProviderDetails", template: "<div />" },
}));
// never calls loadItems itself, like a listing restoring its previous episodes
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["parentItem", "loadItems", "path"],
    template: "<div data-listing />",
  },
}));

const LIBRARY_SHOW = podcast({
  item_id: "7",
  provider: "library",
  total_episodes: 99,
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

describe("PodcastDetails", () => {
  beforeEach(() => {
    mockGetPodcast.mockReset().mockResolvedValue(LIBRARY_SHOW);
    mockGetPodcastEpisodes.mockReset().mockResolvedValue(EPISODES);
    mockSubscribe.mockReset().mockReturnValue(() => {});
  });

  it("shares the list settings of a library podcast with its episode pages", async () => {
    const wrapper = await mountDetails();

    expect(listing(wrapper).props("path")).toBe("podcast.7.library");
  });

  it("counts the episodes for the hero without the listing loading them", async () => {
    const episodes = deferred<PodcastEpisode[]>();
    mockGetPodcastEpisodes.mockReturnValue(episodes.promise);

    const wrapper = await mountDetails();
    expect(hero(wrapper).props("episodeCount")).toBeUndefined();

    episodes.resolve(EPISODES);
    await flushPromises();
    expect(hero(wrapper).props("episodeCount")).toBe(EPISODES.length);
  });

  it("reuses the episodes fetched with the podcast for the first load", async () => {
    const wrapper = await mountDetails();

    const items = await listing(wrapper).props("loadItems")({});

    expect(items).toEqual(EPISODES);
    expect(mockGetPodcastEpisodes).toHaveBeenCalledTimes(1);
  });

  it("fetches the episodes again when the listing refreshes", async () => {
    const wrapper = await mountDetails();

    await listing(wrapper).props("loadItems")({});
    await listing(wrapper).props("loadItems")({ refresh: true });

    expect(mockGetPodcastEpisodes).toHaveBeenCalledTimes(2);
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
});
