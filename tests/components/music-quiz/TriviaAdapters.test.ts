import MultipleChoiceGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoiceGrid.vue";
import MultipleChoicePlayerAnswer from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerAnswer.vue";
import TriviaHostPanel from "@/components/music-quiz/game-types/trivia/TriviaHostPanel.vue";
import TriviaHostRound from "@/components/music-quiz/game-types/trivia/TriviaHostRound.vue";
import TriviaPlayerRound from "@/components/music-quiz/game-types/trivia/TriviaPlayerRound.vue";
import TriviaPresentRound from "@/components/music-quiz/game-types/trivia/TriviaPresentRound.vue";
import type {
  MusicQuizTriviaHostRound,
  MusicQuizTriviaHostState,
  MusicQuizTriviaPersonalizedState,
  MusicQuizTriviaRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { mount, shallowMount } from "@vue/test-utils";
import type { Component } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string, values?: Array<string | number>) =>
    values?.length ? `${key} ${values.join(" ")}` : key,
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

const answeringRound = {
  question: "Which artist released the album Discovery?",
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  auto_advance_at: null,
  suggestions: [
    { suggestion_id: "daft-punk", label: "Daft Punk" },
    { suggestion_id: "air", label: "Air" },
  ],
} satisfies MusicQuizTriviaRound;

const revealRound = {
  ...answeringRound,
  answer_label: "Daft Punk",
  correct_suggestion_id: "daft-punk",
  track_uri: "library://track/daft-punk",
  image_url: null,
  duration: null,
  ended_at: 20,
} satisfies MusicQuizTriviaRound;

const protectedHostRound = {
  round_index: 0,
  answer_label: "Daft Punk",
  suggestions: answeringRound.suggestions,
  correct_suggestion_id: "daft-punk",
  track_uri: "library://track/daft-punk",
  question: answeringRound.question,
  image_url: null,
  duration: null,
  started_at: 1,
  ended_at: null,
  auto_advance_at: null,
} satisfies MusicQuizTriviaHostRound;

const playerState = {
  quiz_type: "trivia",
  answer_type: "multiple_choice",
  language: "en",
  play_reveal_audio: true,
  phase: "answering",
  name: "Music Trivia",
  round_count: 1,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: answeringRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizTriviaPersonalizedState;

const hostState = {
  ...playerState,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [protectedHostRound],
} satisfies MusicQuizTriviaHostState;

const triviaSurfaces: Array<{
  name: string;
  component: Component;
  state: MusicQuizTriviaPersonalizedState | MusicQuizTriviaHostState;
}> = [
  { name: "player", component: TriviaPlayerRound, state: playerState },
  { name: "host", component: TriviaHostRound, state: hostState },
  { name: "present", component: TriviaPresentRound, state: hostState },
];

describe("Trivia adapters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the canonical server language after a host state refresh", async () => {
    const displayNames = new Intl.DisplayNames(["en"], {
      type: "language",
      fallback: "code",
      languageDisplay: "dialect",
    });
    const wrapper = mount(TriviaHostPanel, {
      props: {
        state: { ...hostState, language: "pt-BR" },
        currentRound: hostState.current_round,
      },
    });

    expect(wrapper.get('[data-testid="trivia-language"]').text()).toBe(
      displayNames.of("pt-BR"),
    );

    await wrapper.setProps({
      state: { ...hostState, language: "sr-Latn" },
    });
    expect(wrapper.get('[data-testid="trivia-language"]').text()).toBe(
      displayNames.of("sr-Latn"),
    );
  });

  it.each([
    [true, "providers.music_quiz.reveal_audio_on"],
    [false, "providers.music_quiz.reveal_audio_off"],
    [undefined, "providers.music_quiz.reveal_audio_off"],
  ] as const)(
    "shows the reveal-audio setting after reconnect when set to %s",
    (playRevealAudio, expectedLabel) => {
      const wrapper = mount(TriviaHostPanel, {
        props: {
          state: {
            ...hostState,
            play_reveal_audio: playRevealAudio,
          },
          currentRound: hostState.current_round,
        },
      });

      expect(
        wrapper.get('[data-testid="trivia-reveal-audio"]').text(),
      ).toContain(expectedLabel);
    },
  );

  it.each(triviaSurfaces)(
    "shows the server question in the $name state",
    ({ component, state }) => {
      const wrapper = mount(component, {
        props: {
          state,
          currentRound: answeringRound,
          busy: false,
        },
      });

      expect(wrapper.get('[data-testid="trivia-question"]').text()).toBe(
        answeringRound.question,
      );
      expect(wrapper.find('[data-testid="trivia-answer"]').exists()).toBe(
        false,
      );
      expect(wrapper.find("audio").exists()).toBe(false);
      expect(wrapper.text()).not.toContain("providers.music_quiz.now_playing");
      wrapper.unmount();
    },
  );

  it.each(triviaSurfaces)(
    "shows the server answer in the $name reveal",
    ({ component, state: baseState }) => {
      const state: MusicQuizTriviaPersonalizedState | MusicQuizTriviaHostState =
        {
          ...baseState,
          phase: "reveal",
          current_round: revealRound,
        };
      const wrapper = mount(component, {
        props: {
          state,
          currentRound: revealRound,
          busy: false,
        },
      });

      expect(wrapper.get('[data-testid="trivia-question"]').text()).toBe(
        revealRound.question,
      );
      expect(wrapper.get('[data-testid="trivia-answer"]').text()).toBe(
        revealRound.answer_label,
      );
      expect(wrapper.find("audio").exists()).toBe(false);
      expect(wrapper.html()).not.toContain(revealRound.track_uri);
      wrapper.unmount();
    },
  );

  it("matches answering redaction and reveal audio round fields", () => {
    const disabledRevealRound = {
      ...revealRound,
      track_uri: null,
    } satisfies MusicQuizTriviaRound;
    const disabledRound = {
      ...protectedHostRound,
      track_uri: null,
    } satisfies MusicQuizTriviaHostRound;

    expect("track_uri" in answeringRound).toBe(false);
    expect("image_url" in answeringRound).toBe(false);
    expect("duration" in answeringRound).toBe(false);
    expect("ended_at" in answeringRound).toBe(false);
    expect(revealRound.track_uri).toBe("library://track/daft-punk");
    expect(disabledRevealRound.track_uri).toBeNull();
    expect(revealRound.image_url).toBeNull();
    expect(revealRound.duration).toBeNull();
    expect(revealRound.ended_at).toBe(20);
    expect(protectedHostRound.track_uri).toBe("library://track/daft-punk");
    expect(disabledRound.track_uri).toBeNull();
  });

  it("uses the shared multiple-choice submission and reveal result", () => {
    const answerWrapper = shallowMount(MultipleChoicePlayerAnswer, {
      props: {
        state: playerState,
        currentRound: answeringRound,
        busy: false,
      },
    });

    answerWrapper
      .getComponent(MultipleChoiceGrid)
      .vm.$emit("select", "daft-punk");
    expect(answerWrapper.emitted("submit")).toEqual([
      [
        {
          answer_type: "multiple_choice",
          suggestion_id: "daft-punk",
        },
      ],
    ]);

    const revealState = {
      ...playerState,
      phase: "reveal",
      current_round: revealRound,
      you: {
        ...playerState.you,
        answer: {
          suggestion_id: "daft-punk",
          answered_at: 10,
          correct: true,
          points: 10,
        },
      },
    } satisfies MusicQuizTriviaPersonalizedState;
    const revealWrapper = shallowMount(MultipleChoicePlayerAnswer, {
      props: {
        state: revealState,
        currentRound: revealRound,
        busy: false,
      },
    });

    expect(revealWrapper.text()).toContain("providers.music_quiz.correct");
    expect(revealWrapper.text()).toContain("+10");
  });

  it.each([
    {
      name: "intermediate Ready",
      isFinal: false,
      ready: false,
      label: "providers.music_quiz.ready_for_next_round_countdown",
    },
    {
      name: "intermediate waiting",
      isFinal: false,
      ready: true,
      label: "providers.music_quiz.waiting_for_next_round_countdown",
    },
    {
      name: "final Ready",
      isFinal: true,
      ready: false,
      label: "providers.music_quiz.ready_for_final_results_countdown",
    },
    {
      name: "final waiting",
      isFinal: true,
      ready: true,
      label: "providers.music_quiz.waiting_for_final_results_countdown",
    },
  ])("shows the authoritative 15s $name label", ({ isFinal, ready, label }) => {
    const round = scheduledRevealRound();
    const wrapper = mount(TriviaPlayerRound, {
      props: {
        state: revealPlayerState(round, {
          ready,
          roundCount: isFinal ? 1 : 2,
        }),
        currentRound: round,
        busy: false,
      },
    });
    const button = wrapper.get('[data-testid="trivia-ready"]');

    expect(button.text()).toContain(label);
    expect(button.text()).toContain("15s");
    expect(button.attributes("disabled") !== undefined).toBe(ready);
  });

  it.each([
    [false, "providers.music_quiz.next_round_in"],
    [true, "providers.music_quiz.final_results_in"],
  ] as const)(
    "shows the authoritative 15s %s present countdown",
    (isFinal, label) => {
      const round = scheduledRevealRound();
      const wrapper = mount(TriviaPresentRound, {
        props: {
          state: {
            ...hostState,
            phase: "reveal",
            round_count: isFinal ? 1 : 2,
            current_round: round,
          },
          currentRound: round,
        },
      });
      const countdown = wrapper.get('[data-testid="trivia-auto-advance"]');

      expect(countdown.text()).toContain(label);
      expect(countdown.text()).toContain("15s");
      expect(countdown.attributes("role")).toBe("timer");
    },
  );

  it("derives a reconnected countdown only from auto_advance_at", () => {
    const round = scheduledRevealRound();
    vi.advanceTimersByTime(6_000);

    const wrapper = mount(TriviaPlayerRound, {
      props: {
        state: revealPlayerState(round, { roundCount: 2 }),
        currentRound: round,
        busy: false,
      },
    });

    expect(wrapper.get('[data-testid="trivia-ready"]').text()).toContain("9s");
  });

  it("keeps null auto_advance_at manual on player and present surfaces", () => {
    const round = {
      ...revealRound,
      auto_advance_at: null,
    } satisfies MusicQuizTriviaRound;
    const playerWrapper = mount(TriviaPlayerRound, {
      props: {
        state: revealPlayerState(round, { roundCount: 2 }),
        currentRound: round,
        busy: false,
      },
    });
    const presentWrapper = mount(TriviaPresentRound, {
      props: {
        state: {
          ...hostState,
          phase: "reveal",
          round_count: 2,
          current_round: round,
        },
        currentRound: round,
      },
    });

    expect(playerWrapper.get('[data-testid="trivia-ready"]').text()).toContain(
      "providers.music_quiz.ready",
    );
    expect(playerWrapper.text()).not.toContain("_countdown");
    expect(
      presentWrapper.find('[data-testid="trivia-auto-advance"]').exists(),
    ).toBe(false);
  });

  it("emits Ready once and keeps manual recovery at zero", async () => {
    const round = scheduledRevealRound(1);
    const wrapper = mount(TriviaPlayerRound, {
      props: {
        state: revealPlayerState(round, { roundCount: 2 }),
        currentRound: round,
        busy: false,
      },
    });
    const button = wrapper.get('[data-testid="trivia-ready"]');

    await button.trigger("click");
    await button.trigger("click");
    expect(wrapper.emitted("ready")).toEqual([[]]);

    const elapsedRound = scheduledRevealRound(1);
    const elapsedWrapper = mount(TriviaPlayerRound, {
      props: {
        state: revealPlayerState(elapsedRound, { roundCount: 2 }),
        currentRound: elapsedRound,
        busy: false,
      },
    });
    const elapsedButton = elapsedWrapper.get('[data-testid="trivia-ready"]');

    await vi.advanceTimersByTimeAsync(1_000);

    expect(elapsedButton.text()).toContain("providers.music_quiz.ready");
    expect(elapsedButton.text()).not.toContain("0s");
    expect(elapsedButton.attributes("disabled")).toBeUndefined();
    expect(elapsedWrapper.emitted("ready")).toBeUndefined();

    await elapsedButton.trigger("click");
    await elapsedButton.trigger("click");

    expect(elapsedWrapper.emitted("ready")).toEqual([[]]);

    const presentWrapper = mount(TriviaPresentRound, {
      props: {
        state: {
          ...hostState,
          phase: "reveal",
          round_count: 2,
          current_round: elapsedRound,
        },
        currentRound: elapsedRound,
      },
    });
    const presentCountdown = presentWrapper.get(
      '[data-testid="trivia-auto-advance"]',
    );

    expect(presentCountdown.text()).toContain(
      "providers.music_quiz.waiting_for_next",
    );
    expect(presentCountdown.text()).not.toContain("0s");
  });

  it("keeps an elapsed ready player disabled", () => {
    const round = scheduledRevealRound(-1);
    const wrapper = mount(TriviaPlayerRound, {
      props: {
        state: revealPlayerState(round, {
          ready: true,
          roundCount: 2,
        }),
        currentRound: round,
        busy: false,
      },
    });
    const button = wrapper.get('[data-testid="trivia-ready"]');

    expect(button.text()).toContain("providers.music_quiz.waiting_for_next");
    expect(button.text()).not.toContain("0s");
    expect(button.attributes("disabled")).toBeDefined();
  });

  it("lets a successful server round replace an elapsed Ready request", async () => {
    const elapsedRound = scheduledRevealRound(-1);
    const wrapper = mount(TriviaPlayerRound, {
      props: {
        state: revealPlayerState(elapsedRound, { roundCount: 2 }),
        currentRound: elapsedRound,
        busy: false,
      },
    });

    await wrapper.get('[data-testid="trivia-ready"]').trigger("click");
    expect(wrapper.emitted("ready")).toEqual([[]]);

    const nextRound = {
      ...revealRound,
      round_index: 1,
      auto_advance_at: Date.now() / 1000 + 15,
    } satisfies MusicQuizTriviaRound;
    await wrapper.setProps({
      state: revealPlayerState(nextRound, { roundCount: 2 }),
      currentRound: nextRound,
    });
    const nextButton = wrapper.get('[data-testid="trivia-ready"]');

    expect(nextButton.text()).toContain(
      "providers.music_quiz.ready_for_final_results_countdown",
    );
    expect(nextButton.attributes("disabled")).toBeUndefined();

    await nextButton.trigger("click");

    expect(wrapper.emitted("ready")).toEqual([[], []]);
  });
});

function scheduledRevealRound(seconds = 15) {
  return {
    ...revealRound,
    auto_advance_at: Date.now() / 1000 + seconds,
  } satisfies MusicQuizTriviaRound;
}

function revealPlayerState(
  round: MusicQuizTriviaRound,
  options: { ready?: boolean; roundCount?: number } = {},
) {
  return {
    ...playerState,
    phase: "reveal",
    round_count: options.roundCount ?? 2,
    current_round: round,
    you: {
      ...playerState.you,
      ready: options.ready ?? false,
    },
  } satisfies MusicQuizTriviaPersonalizedState;
}
