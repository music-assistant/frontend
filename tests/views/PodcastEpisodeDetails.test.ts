import type { MusicAssistantApi } from "@/plugins/api";
import type { Podcast, PodcastEpisode } from "@/plugins/api/interfaces";
import PodcastEpisodeDetails from "@/views/PodcastEpisodeDetails.vue";
import { flushPromises, mount, VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { podcast } from "../fixtures/podcast";
import { podcastEpisode } from "../fixtures/podcastEpisode";
import { providerMapping } from "../fixtures/providerMapping";

const {
  mockGetPodcastEpisode,
  mockGetPodcastEpisodes,
  mockGetPodcast,
  mockGetPodcastEpisodeTranscript,
  mockSubscribe,
  mockRouterPush,
} = vi.hoisted(() => ({
  mockGetPodcastEpisode: vi.fn<MusicAssistantApi["getPodcastEpisode"]>(),
  mockGetPodcastEpisodes: vi.fn<MusicAssistantApi["getPodcastEpisodes"]>(),
  mockGetPodcast: vi.fn<MusicAssistantApi["getPodcast"]>(),
  mockGetPodcastEpisodeTranscript:
    vi.fn<MusicAssistantApi["getPodcastEpisodeTranscript"]>(),
  mockSubscribe: vi.fn(() => () => {}),
  mockRouterPush: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getPodcastEpisode: mockGetPodcastEpisode,
    getPodcastEpisodes: mockGetPodcastEpisodes,
    getPodcast: mockGetPodcast,
    getPodcastEpisodeTranscript: mockGetPodcastEpisodeTranscript,
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
// the library copy of SHOW, which is what the podcast lookup returns once it is
// in the library
const LIBRARY_SHOW = podcast({
  item_id: "7",
  provider: "library",
  name: "Show",
  provider_mappings: [
    providerMapping({
      item_id: "pod1",
      provider_domain: "rss",
      provider_instance: "rss",
    }),
  ],
});
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
    mockGetPodcastEpisodeTranscript.mockReset();
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

  it("shares the list settings of a library podcast with its podcast page", async () => {
    mockGetPodcast.mockResolvedValue(LIBRARY_SHOW);

    const wrapper = await mountDetails(EPISODES[1]);

    expect(listing(wrapper).props("parentItem")).toEqual(LIBRARY_SHOW);
    expect(listing(wrapper).props("path")).toBe("podcast.7.library");
  });

  it("waits for the podcast before showing the list", async () => {
    let resolvePodcast!: (value: Podcast) => void;
    mockGetPodcast.mockReturnValue(
      new Promise((resolve) => (resolvePodcast = resolve)),
    );

    const wrapper = await mountDetails(EPISODES[1]);
    expect(listing(wrapper).exists()).toBe(false);

    resolvePodcast(LIBRARY_SHOW);
    await flushPromises();
    expect(listing(wrapper).props("path")).toBe("podcast.7.library");
  });

  it("hides the list while an episode of another podcast loads", async () => {
    const otherShow = podcast({ item_id: "pod2", provider: "rss" });
    const otherEpisode = podcastEpisode({
      item_id: "other1",
      provider: "rss",
      podcast: otherShow,
    });
    const wrapper = await mountDetails(EPISODES[1]);
    let resolvePodcast!: (value: Podcast) => void;
    mockGetPodcastEpisode.mockResolvedValue(otherEpisode);
    mockGetPodcastEpisodes.mockResolvedValue([otherEpisode]);
    mockGetPodcast.mockReturnValue(
      new Promise((resolve) => (resolvePodcast = resolve)),
    );

    await wrapper.setProps({ itemId: "other1" });
    expect(listing(wrapper).exists()).toBe(false);
    await flushPromises();
    expect(listing(wrapper).exists()).toBe(false);

    resolvePodcast(otherShow);
    await flushPromises();
    expect(listing(wrapper).props("path")).toBe("podcast.pod2.rss");
  });

  it("lists the episodes under the episode's podcast when that cannot be loaded", async () => {
    mockGetPodcast.mockRejectedValue(new Error("gone"));

    const wrapper = await mountDetails(EPISODES[1]);

    expect(listing(wrapper).props("path")).toBe("podcast.pod1.rss");
  });

  it("shows no episode when it fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetPodcastEpisode.mockRejectedValue(new Error("gone"));

    const wrapper = await mountDetails(EPISODES[1]);

    expect(hero(wrapper).props("item")).toBeUndefined();
    expect(listing(wrapper).exists()).toBe(false);
  });

  describe("transcript", () => {
    interface TranscriptState {
      transcript: string | null;
      transcriptLoading: boolean;
    }

    it("keeps a transcript that arrives late off the next episode", async () => {
      let resolveOld!: (value: [string | null, null]) => void;
      mockGetPodcastEpisodeTranscript.mockReturnValueOnce(
        new Promise((resolve) => (resolveOld = resolve)),
      );
      const wrapper = await mountDetails(EPISODES[1]);

      hero(wrapper).vm.$emit("transcript");
      await wrapper.setProps({ itemId: "ep1" });
      await flushPromises();
      resolveOld(["old episode", null]);
      await flushPromises();

      const state = wrapper.vm as unknown as TranscriptState;
      expect(state.transcript).toBeNull();
      expect(state.transcriptLoading).toBe(false);
    });

    it("stops loading when the transcript cannot be fetched", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetPodcastEpisodeTranscript.mockRejectedValue(new Error("gone"));
      const wrapper = await mountDetails(EPISODES[1]);

      hero(wrapper).vm.$emit("transcript");
      await flushPromises();

      const state = wrapper.vm as unknown as TranscriptState;
      expect(state.transcript).toBeNull();
      expect(state.transcriptLoading).toBe(false);
    });
  });
});
