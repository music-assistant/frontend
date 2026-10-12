import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import type { MusicQuizGuessTheSongRound } from "@/composables/music-quiz/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const baseProps: {
  round: MusicQuizGuessTheSongRound;
  imageUrl: string;
  showCopyButton?: boolean;
} = {
  round: {
    question: "Which song is playing?",
    round_index: 0,
    started_at: 0,
    deadline: 0,
    auto_advance_at: null,
    suggestions: [],
    answer_label: "Song",
  },
  imageUrl: "",
};

function mountReveal(props: Partial<typeof baseProps> = {}) {
  return mount(GuessTheSongReveal, {
    props: { ...baseProps, ...props },
  });
}

describe("GuessTheSongReveal", () => {
  it("renders the answer label and artwork", () => {
    const wrapper = mountReveal({ imageUrl: "cover.jpg" });

    expect(wrapper.text()).toContain("Song");
    expect(wrapper.get("img").attributes("src")).toBe("cover.jpg");
  });

  it("uses the copy tooltip as the button's accessible name", () => {
    const wrapper = mountReveal();
    const copyButton = wrapper.get("button");

    expect(copyButton.attributes("title")).toBe(
      "providers.music_quiz.copy_music_name",
    );
    expect(copyButton.attributes("aria-label")).toBe(
      "providers.music_quiz.copy_music_name",
    );
  });

  it("hides the copy button when showCopyButton is false", () => {
    const wrapper = mountReveal({ showCopyButton: false });

    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("emits copy-title when the copy button is clicked", async () => {
    const wrapper = mountReveal();

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("copy-title")).toEqual([[]]);
  });
});
