import type { MusicAssistantApi } from "@/plugins/api";
import type { PodcastEpisode } from "@/plugins/api/interfaces";
import PodcastEpisodeDetails from "@/views/PodcastEpisodeDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { podcast } from "../fixtures/podcast";
import { podcastEpisode } from "../fixtures/podcastEpisode";

const {
  mockGetPodcastEpisode,
  mockGetPodcastEpisodes,
  mockGetPodcast,
  mockSubscribe,
  mockRouterPush,
} = vi.hoisted(() => ({
  mockGetPodcastEpisode: vi.fn<MusicAssistantApi["getPodcastEpisode"]>(),
  mockGetPodcastEpisodes: vi.fn<MusicAssistantApi["getPodcastEpisodes"]>(),
  mockGetPodcast: vi.fn<MusicAssistantApi["getPodcast"]>(),
  mockSubscribe: vi.fn(() => () => {}),
  mockRouterPush: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getPodcastEpisode: mockGetPodcastEpisode,
    getPodcastEpisodes: mockGetPodcastEpisodes,
    getPodcast: mockGetPodcast,
    subscribe: mockSubscribe,
  },
}));
vi.mock("@/plugins/store", () => ({ store: { currentUser: undefined } }));
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/components/podcast/PodcastEpisodeHero.vue", () => ({
  default: {
    name: "PodcastEpisodeHero",
    props: ["item", "parentPodcast", "hasPrevious", "hasNext"],
    emits: ["previous", "next", "transcript"],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/details/DetailTextRow.vue", () => ({
  default: { name: "DetailTextRow", template: "<div />" },
}));
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["parentItem", "loadItems", "path"],
    template: "<div data-listing />",
  },
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: { props: ["open"], template: "<div />" },
  DialogContent: { template: "<div />" },
  DialogDescription: { template: "<div />" },
  DialogFooter: { template: "<div />" },
  DialogHeader: { template: "<div />" },
  DialogTitle: { template: "<div />" },
}));

const SHOW = podcast({ item_id: "pod1", provider: "rss", name: "Show" });
const EPISODES = [1, 2, 3].map((position) =>
  podcastEpisode({
    item_id: `ep${position}`,
    provider: "rss",
    position,
    podcast: SHOW,
  }),
);

async function mountDetails(episode: PodcastEpisode) {
  const wrapper = mount(PodcastEpisodeDetails, {
    props: { itemId: episode.item_id, provider: episode.provider },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function hero(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "PodcastEpisodeHero" });
}

function listing(wrapper: VueWrapper) {
  return wrapper.findComponent({ name: "ItemsListing" });
}

describe("PodcastEpisodeDetails", () => {
  beforeEach(() => {
    mockGetPodcastEpisode
      .mockReset()
      .mockImplementation(async (itemId) =>
        EPISODES.find((episode) => episode.item_id === itemId)!,
      );
    mockGetPodcastEpisodes.mockReset().mockResolvedValue(EPISODES);
    mockGetPodcast.mockReset().mockResolvedValue(SHOW);
    mockSubscribe.mockReset().mockReturnValue(() => {});
    mockRouterPush.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // the steppers follow the listing's newest first order
  it("steps to the newer episode as previous and the older one as next", async () => {
    const wrapper = await mountDetails(EPISODES[1]);

    hero(wrapper).vm.$emit("previous");
    hero(wrapper).vm.$emit("next");

    expect(mockRouterPush.mock.calls).toEqual([
      [{ name: "podcast_episode", params: { itemId: "ep3", provider: "rss" } }],
      [{ name: "podcast_episode", params: { itemId: "ep1", provider: "rss" } }],
    ]);
  });

  it("has no newer episode to step to from the latest one", async () => {
    const wrapper = await mountDetails(EPISODES[2]);

    expect(hero(wrapper).props("hasPrevious")).toBe(false);
    expect(hero(wrapper).props("hasNext")).toBe(true);
  });

  it("lists the other episodes with the episode's own podcast", async () => {
    const wrapper = await mountDetails(EPISODES[1]);

    expect(listing(wrapper).props("parentItem")).toEqual(SHOW);
    const others = await listing(wrapper).props("loadItems")();
    expect(others.map((episode: PodcastEpisode) => episode.item_id)).toEqual([
      "ep1",
      "ep3",
    ]);
  });

  it("shows no episode when it fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetPodcastEpisode.mockRejectedValue(new Error("gone"));

    const wrapper = await mountDetails(EPISODES[1]);

    expect(hero(wrapper).props("item")).toBeUndefined();
    expect(listing(wrapper).exists()).toBe(false);
  });
});
