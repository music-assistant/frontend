import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventType } from "@/plugins/api/interfaces";
import type { EventMessage, PodcastEpisode } from "@/plugins/api/interfaces";

const {
  mockGetLibraryPodcasts,
  mockGetPodcastEpisodes,
  mockSubscribe,
  mockUnsubscribe,
  mockRouterPush,
} = vi.hoisted(() => ({
  mockGetLibraryPodcasts: vi.fn(),
  mockGetPodcastEpisodes: vi.fn(),
  mockSubscribe: vi.fn(),
  mockUnsubscribe: vi.fn(),
  mockRouterPush: vi.fn(),
}));

let playedCallback: ((evt: EventMessage) => void) | undefined;

vi.mock("@/plugins/api", () => ({
  api: {
    getLibraryPodcasts: mockGetLibraryPodcasts,
    getPodcastEpisodes: mockGetPodcastEpisodes,
    subscribe: mockSubscribe,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

import LatestPodcastEpisodes from "@/views/LatestPodcastEpisodes.vue";
import LatestPodcastEpisodeItem from "@/components/LatestPodcastEpisodeItem.vue";
import { Switch } from "@/components/ui/switch";

function makeEpisode(id: string, releaseDate: string): PodcastEpisode {
  return {
    item_id: id,
    provider: "test",
    name: id,
    uri: `podcast_episode://test/${id}`,
    metadata: { release_date: releaseDate },
  } as unknown as PodcastEpisode;
}

function mountView() {
  return shallowMount(LatestPodcastEpisodes, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        // Render the container slot so the episode list is inspectable.
        Container: { template: "<div><slot /></div>" },
      },
    },
  });
}

describe("LatestPodcastEpisodes playback sync", () => {
  beforeEach(() => {
    playedCallback = undefined;
    mockGetLibraryPodcasts.mockReset();
    mockGetPodcastEpisodes.mockReset();
    mockSubscribe.mockReset();
    mockUnsubscribe.mockReset();
    mockRouterPush.mockReset();

    mockGetLibraryPodcasts.mockImplementation((_a, _b, _size, offset = 0) =>
      offset === 0
        ? Promise.resolve([{ item_id: "p1", provider: "test" }])
        : Promise.resolve([]),
    );
    mockGetPodcastEpisodes.mockResolvedValue([
      makeEpisode("e1", "2024-01-02"),
      makeEpisode("e2", "2024-01-01"),
    ]);
    mockSubscribe.mockImplementation(
      (_event: EventType, cb: (evt: EventMessage) => void) => {
        playedCallback = cb;
        return mockUnsubscribe;
      },
    );
  });

  it("subscribes to MEDIA_ITEM_PLAYED on mount", async () => {
    mountView();
    await flushPromises();

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith(
      EventType.MEDIA_ITEM_PLAYED,
      expect.any(Function),
    );
  });

  it("updates a matching episode's playback data immediately", async () => {
    const wrapper = mountView();
    await flushPromises();

    playedCallback?.({
      event: EventType.MEDIA_ITEM_PLAYED,
      object_id: "podcast_episode://test/e1",
      data: { fully_played: false, seconds_played: 30 },
    });
    await flushPromises();

    const items = wrapper.findAllComponents(LatestPodcastEpisodeItem);
    const e1 = items.find(
      (i) => (i.props("episode") as PodcastEpisode).item_id === "e1",
    );
    expect(e1?.props("episode")).toMatchObject({
      resume_position_ms: 30000,
    });
  });

  it("drops a fully played episode from the unplayed-only filter immediately", async () => {
    const wrapper = mountView();
    await flushPromises();

    // Enable the unplayed-only filter.
    wrapper.findComponent(Switch).vm.$emit("update:modelValue", true);
    await flushPromises();
    expect(wrapper.findAllComponents(LatestPodcastEpisodeItem)).toHaveLength(2);

    playedCallback?.({
      event: EventType.MEDIA_ITEM_PLAYED,
      object_id: "podcast_episode://test/e1",
      data: { fully_played: true, seconds_played: 120 },
    });
    await flushPromises();

    const remaining = wrapper.findAllComponents(LatestPodcastEpisodeItem);
    expect(remaining).toHaveLength(1);
    expect((remaining[0].props("episode") as PodcastEpisode).item_id).toBe(
      "e2",
    );
  });

  it("ignores playback events for an unrelated uri", async () => {
    const wrapper = mountView();
    await flushPromises();

    playedCallback?.({
      event: EventType.MEDIA_ITEM_PLAYED,
      object_id: "podcast_episode://test/unknown",
      data: { fully_played: true, seconds_played: 99 },
    });
    await flushPromises();

    const items = wrapper.findAllComponents(LatestPodcastEpisodeItem);
    expect(items).toHaveLength(2);
    for (const item of items) {
      const episode = item.props("episode") as PodcastEpisode;
      expect(episode.fully_played).toBeUndefined();
      expect(episode.resume_position_ms).toBeUndefined();
    }
  });

  it("unsubscribes on unmount", async () => {
    const wrapper = mountView();
    await flushPromises();

    wrapper.unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
