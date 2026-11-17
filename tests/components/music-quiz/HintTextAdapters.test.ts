import HintTextArtistBonus from "@/components/music-quiz/answer-types/hint-text/HintTextArtistBonus.vue";
import HintTextMask from "@/components/music-quiz/answer-types/hint-text/HintTextMask.vue";
import HintTextPlayerAnswer from "@/components/music-quiz/answer-types/hint-text/HintTextPlayerAnswer.vue";
import HintTextPresentAnswer from "@/components/music-quiz/answer-types/hint-text/HintTextPresentAnswer.vue";
import type {
  MusicQuizTitleRevealPersonalizedState,
  MusicQuizTitleRevealRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}:${args.join(",")}` : key,
}));

const currentRound = {
  question: null,
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  auto_advance_at: null,
  mask: ["H", null, null, " ", null, null, null, "!"],
  revealed_count: 1,
  hint_count: 4,
  allowed_typos: 1,
  artist_bonus: false,
} satisfies MusicQuizTitleRevealRound;

function playerState(
  you: Partial<MusicQuizTitleRevealPersonalizedState["you"]> = {},
): MusicQuizTitleRevealPersonalizedState {
  return {
    quiz_type: "title_reveal",
    answer_type: "hint_text",
    hint_speed: "normal",
    typo_tolerance: "normal",
    artist_bonus_mode: "free_text",
    phase: "answering",
    name: "Quiz",
    include_similar_music: false,
    auto_start_at: null,
    round_count: 5,
    answer_duration: 30,
    mode: "remote",
    players: [
      {
        name: "Alice",
        score: 0,
        ready: false,
        answered: true,
        active_from_round: 0,
        solved_rank: 1,
      },
      {
        name: "Player",
        score: 0,
        ready: false,
        answered: false,
        active_from_round: 0,
        solved_rank: null,
      },
    ],
    current_round: currentRound,
    you: {
      name: "Player",
      score: 0,
      ready: false,
      active_from_round: 0,
      guesses: [],
      attempts_left: 30,
      solved: false,
      ...you,
    },
  };
}

describe("hint-text adapters", () => {
  it("renders hidden letters as blanks and keeps punctuation visible", () => {
    const wrapper = mount(HintTextMask, { props: { mask: currentRound.mask } });

    const cells = wrapper.findAll("span");
    expect(cells.map((cell) => cell.text())).toEqual([
      "H",
      "",
      "",
      "",
      "",
      "",
      "!",
    ]);
    expect(wrapper.attributes("aria-label")).toBe(
      "providers.music_quiz.title_reveal_mask_label:H__ ___!,5",
    );
    wrapper.unmount();
  });

  it("emits a trimmed guess and clears the input for the next one", async () => {
    const wrapper = mount(HintTextPlayerAnswer, {
      props: { state: playerState(), currentRound, busy: false },
      attachTo: document.body,
    });
    const input = wrapper.get<HTMLInputElement>(
      "[data-testid='hint-text-input']",
    );

    await input.setValue("  hey jude ");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")).toEqual([
      [{ answer_type: "hint_text", action: "guess_title", text: "hey jude" }],
    ]);
    expect(input.element.value).toBe("");
    expect(document.activeElement).toBe(input.element);
    wrapper.unmount();
  });

  it("clears an unsent guess when the next round starts", async () => {
    const wrapper = mount(HintTextPlayerAnswer, {
      props: { state: playerState(), currentRound, busy: false },
    });

    await wrapper.get("[data-testid='hint-text-input']").setValue("hey ju");
    await wrapper.setProps({
      currentRound: { ...currentRound, round_index: 1 },
    });

    expect(
      wrapper.get<HTMLInputElement>("[data-testid='hint-text-input']").element
        .value,
    ).toBe("");
    wrapper.unmount();
  });

  it("does not submit an empty guess or one without guesses left", async () => {
    const wrapper = mount(HintTextPlayerAnswer, {
      props: {
        state: playerState({ attempts_left: 0 }),
        currentRound,
        busy: false,
      },
    });

    await wrapper.get("[data-testid='hint-text-input']").setValue("hey jude");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(
      wrapper.get("[data-testid='hint-text-submit']").attributes("disabled"),
    ).toBeDefined();
    wrapper.unmount();
  });

  it("lists wrong guesses newest first and flags close ones", () => {
    const wrapper = mount(HintTextPlayerAnswer, {
      props: {
        state: playerState({
          guesses: [
            { text: "Hey Joe", correct: false, close: true },
            { text: "Help", correct: false, close: false },
          ],
        }),
        currentRound,
        busy: false,
      },
    });

    const items = wrapper.findAll("li").slice(0, 2);
    expect(items.map((item) => item.text())).toEqual([
      "Help",
      "Hey Joeproviders.music_quiz.title_reveal_close",
    ]);
    wrapper.unmount();
  });

  it("replaces the input with the solution once solved", () => {
    const wrapper = mount(HintTextPlayerAnswer, {
      props: {
        state: playerState({
          solved: true,
          solution: "Hey Jude!",
          points: 820,
        }),
        currentRound,
        busy: false,
      },
    });

    expect(wrapper.find("form").exists()).toBe(false);
    const solved = wrapper.get("[data-testid='hint-text-solved']");
    expect(solved.text()).toContain("Hey Jude!");
    expect(solved.text()).toContain(
      "providers.music_quiz.title_reveal_points:820",
    );
    wrapper.unmount();
  });

  it("shows the mask and who already guessed on the dashboard", () => {
    const { you: _you, ...publicState } = playerState();
    const wrapper = mount(HintTextPresentAnswer, {
      props: { state: publicState, currentRound },
    });

    expect(wrapper.find("[data-testid='hint-text-mask']").exists()).toBe(true);
    expect(wrapper.text()).toContain("1 / 2");
    expect(wrapper.text()).not.toContain("Hey Jude");
    wrapper.unmount();
  });

  it("shows the first-guess bonus once solved", () => {
    const wrapper = mount(HintTextPlayerAnswer, {
      props: {
        state: playerState({
          solved: true,
          solution: "Hey Jude",
          points: 1200,
          first_bonus: 200,
        }),
        currentRound,
        busy: false,
      },
    });

    expect(wrapper.get("[data-testid='hint-text-first-bonus']").text()).toBe(
      "providers.music_quiz.title_reveal_first_bonus:200",
    );
    expect(
      wrapper.find("[data-testid='hint-text-artist-bonus']").exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it("offers the artist bonus after the title and forwards guesses", async () => {
    const wrapper = mount(HintTextPlayerAnswer, {
      props: {
        state: playerState({
          solved: true,
          solution: "Hey Jude",
          points: 900,
          artist_bonus: { done: false },
        }),
        currentRound: { ...currentRound, artist_bonus: true },
        busy: false,
      },
    });

    await wrapper
      .get("[data-testid='hint-text-artist-input']")
      .setValue(" The Beatles ");
    await wrapper
      .get("[data-testid='hint-text-artist-bonus']")
      .trigger("submit");
    await wrapper.get("[data-testid='hint-text-artist-skip']").trigger("click");

    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          answer_type: "hint_text",
          action: "guess_artist",
          text: "The Beatles",
        },
      ],
      [{ answer_type: "hint_text", action: "skip_artist" }],
    ]);
    wrapper.unmount();
  });

  it("shows the artist bonus result once answered", () => {
    const correct = mount(HintTextArtistBonus, {
      props: {
        bonus: {
          done: true,
          guess: "beatles",
          correct: true,
          points: 250,
          artist: "The Beatles",
        },
        busy: false,
      },
    });
    const skipped = mount(HintTextArtistBonus, {
      props: {
        bonus: {
          done: true,
          guess: null,
          correct: false,
          points: 0,
          artist: "The Beatles",
        },
        busy: false,
      },
    });

    expect(correct.get("[data-testid='hint-text-artist-result']").text()).toBe(
      "providers.music_quiz.title_reveal_artist_correct:The Beatles,250",
    );
    expect(skipped.get("[data-testid='hint-text-artist-result']").text()).toBe(
      "providers.music_quiz.title_reveal_artist_skipped:The Beatles",
    );
    correct.unmount();
    skipped.unmount();
  });
});
