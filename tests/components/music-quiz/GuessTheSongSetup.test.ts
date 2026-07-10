import GuessTheSongSetup from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongSetup.vue";
import { MediaType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearch, mockToastError } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    search: mockSearch,
  },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    name: "MediaItemThumb",
    template: "<div />",
  },
}));

type SearchResult = {
  tracks: Array<{ uri: string; name: string; media_type: MediaType }>;
  playlists: Array<{ uri: string; name: string; media_type: MediaType }>;
};

type DeferredSearch = {
  promise: Promise<SearchResult>;
  resolve: (value: SearchResult) => void;
};

function deferredSearch(): DeferredSearch {
  let resolvePromise: (value: SearchResult) => void = () => {};
  const promise = new Promise<SearchResult>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: resolvePromise,
  };
}

async function flushPromises() {
  await Promise.resolve();
  await nextTick();
}

function mountConfig() {
  return mount(GuessTheSongSetup, {
    props: { busy: false },
    global: {
      stubs: {
        Button: { template: "<button><slot /></button>" },
      },
    },
  });
}

describe("GuessTheSongSetup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSearch.mockReset();
    mockToastError.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the latest source-search result when older requests finish later", async () => {
    const oldSearch = deferredSearch();
    const newSearch = deferredSearch();
    mockSearch.mockImplementation((query: string) =>
      query === "old" ? oldSearch.promise : newSearch.promise,
    );

    const wrapper = mountConfig();

    const searchInput = wrapper.find(
      'input[placeholder="providers.music_quiz.search_music"]',
    );
    await searchInput.setValue("old");
    await vi.advanceTimersByTimeAsync(250);
    expect(mockSearch).toHaveBeenCalledWith(
      "old",
      [MediaType.TRACK, MediaType.PLAYLIST],
      8,
    );

    await searchInput.setValue("new");
    await vi.advanceTimersByTimeAsync(250);
    expect(mockSearch).toHaveBeenCalledWith(
      "new",
      [MediaType.TRACK, MediaType.PLAYLIST],
      8,
    );

    newSearch.resolve({
      tracks: [
        {
          uri: "track:new",
          name: "Newest result",
          media_type: MediaType.TRACK,
        },
      ],
      playlists: [],
    });
    await flushPromises();
    expect(wrapper.text()).toContain("Newest result");

    oldSearch.resolve({
      tracks: [
        { uri: "track:old", name: "Older result", media_type: MediaType.TRACK },
      ],
      playlists: [],
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Newest result");
    expect(wrapper.text()).not.toContain("Older result");
  });

  it("emits a discriminated create request", async () => {
    mockSearch.mockResolvedValue({
      tracks: [
        {
          uri: "track:test",
          name: "Test track",
          media_type: MediaType.TRACK,
        },
      ],
      playlists: [],
    });
    const wrapper = mountConfig();

    await wrapper
      .find('input[placeholder="providers.music_quiz.search_music"]')
      .setValue("test");
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Test track"))
      ?.trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("create"))
      ?.trigger("click");

    expect(wrapper.emitted("create")?.[0]?.[0]).toMatchObject({
      quiz_type: "guess_the_song",
      answer_type: "multiple_choice",
      config: {
        round_count: 5,
        suggestion_count: 4,
        answer_duration: 30,
        difficulty: "normal",
        source_uris: ["track:test"],
      },
    });
  });
});
