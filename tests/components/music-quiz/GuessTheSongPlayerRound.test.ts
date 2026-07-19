import GuessTheSongPlayerRound from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongPlayerRound.vue";
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type {
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/useMusicQuiz";
import { MediaType } from "@/plugins/api/interfaces";
import { shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCopyToClipboard,
  mockGetItemByUri,
  mockGetTrackLyrics,
  mockToastError,
} = vi.hoisted(() => ({
  mockCopyToClipboard: vi.fn(),
  mockGetItemByUri: vi.fn(),
  mockGetTrackLyrics: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    getItemByUri: mockGetItemByUri,
    getTrackLyrics: mockGetTrackLyrics,
  },
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: mockCopyToClipboard,
  getMediaImageUrl: (url: string) => url,
}));

vi.mock(
  "@/components/music-quiz/game-types/guess-the-song/useGuessTheSongPlaybackPosition",
  async () => {
    const { ref } = await import("vue");
    return {
      useGuessTheSongPlaybackPosition: () => ({
        position: ref(12),
        teardown: vi.fn(),
      }),
    };
  },
);

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

const currentRound = {
  question: "Which song is playing?",
  round_index: 0,
  started_at: 1,
  deadline: 2,
  auto_advance_at: null,
  suggestions: [],
  answer_label: "Artist - Song",
  track_uri: "library://track/1",
  image_url: "image.jpg",
  duration: 120,
} satisfies MusicQuizGuessTheSongRound;

describe("GuessTheSongPlayerRound", () => {
  beforeEach(() => {
    mockCopyToClipboard.mockReset();
    mockGetItemByUri.mockReset();
    mockGetTrackLyrics.mockReset();
    mockToastError.mockReset();
  });

  it("does not initialize lyrics while answering", () => {
    const wrapper = mountRound(createState("answering"));

    expect(mockGetItemByUri).not.toHaveBeenCalled();
    expect(wrapper.findComponent(GuessTheSongReveal).exists()).toBe(false);
    wrapper.unmount();
  });

  it("passes loaded lyrics and playback position to the reveal", async () => {
    mockGetItemByUri.mockResolvedValue({ media_type: MediaType.TRACK });
    mockGetTrackLyrics.mockResolvedValue(["Plain lyrics", "Synced lyrics"]);
    const wrapper = mountRound(createState("reveal"));

    await flushPromises();

    const reveal = wrapper.getComponent(GuessTheSongReveal);
    expect(mockGetItemByUri).toHaveBeenCalledWith("library://track/1");
    expect(reveal.props("hasLyrics")).toBe(true);
    expect(reveal.props("lyrics")).toBe("Plain lyrics");
    expect(reveal.props("lrcLyrics")).toBe("Synced lyrics");
    expect(reveal.props("lyricsPosition")).toBe(12);
    wrapper.unmount();
  });

  it("keeps the loading state until the lyrics request completes", () => {
    mockGetItemByUri.mockReturnValue(new Promise(() => {}));
    const wrapper = mountRound(createState("reveal"));

    expect(
      wrapper.getComponent(GuessTheSongReveal).props("lyricsLoading"),
    ).toBe(true);
    wrapper.unmount();
  });

  it("keeps copy failures inside the game adapter", async () => {
    mockGetItemByUri.mockReturnValue(new Promise(() => {}));
    mockCopyToClipboard.mockResolvedValue(false);
    const wrapper = mountRound(createState("reveal"));

    wrapper.getComponent(GuessTheSongReveal).vm.$emit("copy-title");
    await flushPromises();

    expect(mockCopyToClipboard).toHaveBeenCalledWith("Artist - Song");
    expect(mockToastError).toHaveBeenCalledWith(
      "providers.music_quiz.copy_music_name_failed",
    );
    wrapper.unmount();
  });

  it("forwards the shared ready action", () => {
    mockGetItemByUri.mockReturnValue(new Promise(() => {}));
    const wrapper = mountRound(createState("reveal"));

    wrapper.getComponent(GuessTheSongReveal).vm.$emit("ready");

    expect(wrapper.emitted("ready")).toEqual([[]]);
    wrapper.unmount();
  });

  it("ignores lyrics returned for an older round", async () => {
    const firstLyrics = deferred<[string | null, string | null]>();
    mockGetItemByUri.mockResolvedValue({ media_type: MediaType.TRACK });
    mockGetTrackLyrics
      .mockReturnValueOnce(firstLyrics.promise)
      .mockResolvedValueOnce(["Second lyrics", null]);
    const wrapper = mountRound(createState("reveal"));
    await flushPromises();

    await wrapper.setProps({
      currentRound: {
        ...currentRound,
        track_uri: "library://track/2",
      },
    });
    await flushPromises();
    firstLyrics.resolve(["First lyrics", null]);
    await flushPromises();

    expect(wrapper.getComponent(GuessTheSongReveal).props("lyrics")).toBe(
      "Second lyrics",
    );
    wrapper.unmount();
  });
});

function createState(
  phase: MusicQuizGuessTheSongPersonalizedState["phase"],
): MusicQuizGuessTheSongPersonalizedState {
  return {
    quiz_type: "guess_the_song",
    answer_type: "multiple_choice",
    phase,
    name: "Quiz",
    round_count: 1,
    suggestion_count: 2,
    answer_duration: 30,
    mode: "venue",
    players: [],
    current_round: currentRound,
    you: {
      name: "Player",
      score: 0,
      ready: false,
      active_from_round: 0,
    },
  };
}

function mountRound(state: MusicQuizGuessTheSongPersonalizedState) {
  return shallowMount(GuessTheSongPlayerRound, {
    props: {
      state,
      currentRound,
      busy: false,
    },
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}
