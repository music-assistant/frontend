import MusicQuizReveal from "@/components/music-quiz/MusicQuizReveal.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

const baseProps = {
  round: {
    round_index: 0,
    started_at: 0,
    deadline: 0,
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

describe("MusicQuizReveal", () => {
  it("shows a loading state while lyrics are still being fetched", () => {
    const wrapper = mount(MusicQuizReveal, {
      props: {
        ...baseProps,
        lyricsLoading: true,
      },
      global: {
        stubs: {
          LyricsViewer: true,
          Button: {
            template: "<button><slot /></button>",
          },
        },
        mocks: {
          $t: (key: string) => key,
        },
      },
    });

    expect(wrapper.text()).toContain("providers.music_quiz.loading_lyrics");
    expect(wrapper.text()).not.toContain("no_lyrics_available");
  });

  it("shows a no-lyrics terminal state after loading completes without lyrics", () => {
    const wrapper = mount(MusicQuizReveal, {
      props: {
        ...baseProps,
        lyricsLoading: false,
      },
      global: {
        stubs: {
          LyricsViewer: true,
          Button: {
            template: "<button><slot /></button>",
          },
        },
        mocks: {
          $t: (key: string) => key,
        },
      },
    });

    expect(wrapper.text()).toContain("no_lyrics_available");
    expect(wrapper.text()).not.toContain("providers.music_quiz.loading_lyrics");
  });
});
