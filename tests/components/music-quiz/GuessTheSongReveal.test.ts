import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const baseProps = {
  round: {
    question: "Which song is playing?",
    round_index: 0,
    started_at: 0,
    deadline: 0,
    auto_advance_at: null,
    suggestions: [],
    answer_label: "Song",
  },
  busy: false,
  isReady: false,
  readyLabel: "Ready",
  imageUrl: "",
  showLyrics: true,
  hasLyrics: false,
  lyrics: "",
  lrcLyrics: "",
  lyricsPosition: 0,
  lyricsTextColor: "white",
  showReadyButton: false,
};

function mountReveal(lyricsLoading: boolean) {
  return mount(GuessTheSongReveal, {
    props: { ...baseProps, lyricsLoading },
    global: {
      stubs: {
        LyricsViewer: true,
        Button: { template: "<button><slot /></button>" },
      },
    },
  });
}

describe("GuessTheSongReveal", () => {
  it("shows a loading state while lyrics are still being fetched", () => {
    const wrapper = mountReveal(true);
    expect(wrapper.text()).toContain("providers.music_quiz.loading_lyrics");
    expect(wrapper.text()).not.toContain("no_lyrics_available");
  });

  it("shows a no-lyrics terminal state after loading completes without lyrics", () => {
    const wrapper = mountReveal(false);
    expect(wrapper.text()).toContain("no_lyrics_available");
    expect(wrapper.text()).not.toContain("providers.music_quiz.loading_lyrics");
  });
});
