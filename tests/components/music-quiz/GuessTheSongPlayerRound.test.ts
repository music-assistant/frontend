import GuessTheSongPlayerRound from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongPlayerRound.vue";
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type {
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import type { MusicAssistantApi } from "@/plugins/api";
import { mount, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCopyToClipboard,
  mockGetItemByUri,
  mockGetTrackLyrics,
  mockToastError,
} = vi.hoisted(() => ({
  mockCopyToClipboard: vi.fn(),
  mockGetItemByUri: vi.fn<MusicAssistantApi["getItemByUri"]>(),
  mockGetTrackLyrics: vi.fn<MusicAssistantApi["getTrackLyrics"]>(),
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

  it("renders nothing while answering", () => {
    const wrapper = mountRound(createState("answering"));

    expect(wrapper.findComponent(GuessTheSongReveal).exists()).toBe(false);
    wrapper.unmount();
  });

  it("does not fetch lyrics on reveal", () => {
    const wrapper = mountRound(createState("reveal"));

    expect(mockGetItemByUri).not.toHaveBeenCalled();
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("passes the round and artwork to the reveal", () => {
    const wrapper = mountRound(createState("reveal"));

    const reveal = wrapper.getComponent(GuessTheSongReveal);
    expect(reveal.props("round")).toEqual(currentRound);
    expect(reveal.props("imageUrl")).toBe("image.jpg");
    wrapper.unmount();
  });

  it("keeps copy failures inside the game adapter", async () => {
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

  it("pins the Ready button to the bottom of the stage during reveal", async () => {
    const wrapper = mount(GuessTheSongPlayerRound, {
      props: {
        state: createState("reveal"),
        currentRound,
        busy: false,
      },
    });
    const readyButton = wrapper.get('[data-testid="guess-the-song-ready"]');
    const footer = readyButton.element.parentElement;

    expect(footer?.classList.contains("sticky")).toBe(true);
    expect(
      footer?.classList.contains("bottom-[var(--device-inset-bottom,0px)]"),
    ).toBe(true);
    expect(footer?.classList.contains("order-last")).toBe(true);

    await readyButton.trigger("click");

    expect(wrapper.emitted("ready")).toEqual([[]]);
    wrapper.unmount();
  });

  it("flips the Ready label once the player is marked ready", async () => {
    const wrapper = mount(GuessTheSongPlayerRound, {
      props: {
        state: createState("reveal"),
        currentRound,
        busy: false,
      },
    });
    const readyButton = wrapper.get('[data-testid="guess-the-song-ready"]');

    expect(readyButton.text()).toContain("providers.music_quiz.ready");

    await wrapper.setProps({
      state: {
        ...createState("reveal"),
        you: { ...createState("reveal").you, ready: true },
      },
    });

    expect(readyButton.text()).toContain(
      "providers.music_quiz.waiting_for_next",
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
