import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import type {
  MusicQuizHitsterPersonalizedState,
  MusicQuizHitsterRound,
  MusicQuizTimelineBonusAnswer,
} from "@/composables/useMusicQuiz";
import { mount, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

const anchor = {
  entry_id: "anchor",
  release_year: 1990,
  title: "Anchor",
  artist: "Known Artist",
  track_uri: "library://track/anchor",
  image_url: null,
  is_anchor: true,
} as const;

const baseRound = {
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  question: null,
  timeline: [anchor],
  bonus_definitions: [],
} satisfies MusicQuizHitsterRound;

const player = {
  name: "Player",
  score: 0,
  ready: false,
  answered: false,
  placed: false,
  artist_bonus_answered: false,
  title_bonus_answered: false,
};

const baseState = {
  quiz_type: "hitster",
  answer_type: "timeline",
  phase: "answering",
  name: "Hitster",
  round_count: 1,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [player],
  current_round: baseRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizHitsterPersonalizedState;

function stateWithAnswer(
  bonuses: MusicQuizTimelineBonusAnswer[] = [],
  finished = false,
): MusicQuizHitsterPersonalizedState {
  return {
    ...baseState,
    artist_bonus_mode: "free_text",
    title_bonus_mode: "multiple_choice",
    players: [
      {
        ...player,
        placed: true,
        artist_bonus_answered: bonuses.some(
          (answer) => answer.bonus_type === "artist",
        ),
        title_bonus_answered: bonuses.some(
          (answer) => answer.bonus_type === "title",
        ),
        answered: finished,
      },
    ],
    you: {
      ...baseState.you,
      answer: {
        previous_entry_id: "anchor",
        next_entry_id: null,
        answered_at: 10,
        bonuses,
        finished,
      },
    },
  };
}

const bonusRound = {
  ...baseRound,
  bonus_definitions: [
    {
      bonus_type: "artist",
      mode: "free_text",
    },
    {
      bonus_type: "title",
      mode: "multiple_choice",
      options: [
        { option_id: "title-a", label: "Title A" },
        { option_id: "title-b", label: "Title B" },
      ],
    },
  ],
} satisfies MusicQuizHitsterRound;

describe("TimelinePlayerAnswer", () => {
  it("submits exact start and end placement boundaries", () => {
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state: baseState,
        currentRound: baseRound,
        busy: false,
      },
    });
    const timeline = wrapper.getComponent(TimelineDisplay);

    timeline.vm.$emit("select", null, "anchor");
    timeline.vm.$emit("select", "anchor", null);

    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          answer_type: "timeline",
          action: "place",
          previous_entry_id: null,
          next_entry_id: "anchor",
        },
      ],
      [
        {
          answer_type: "timeline",
          action: "place",
          previous_entry_id: "anchor",
          next_entry_id: null,
        },
      ],
    ]);
  });

  it("keeps late joiners waiting until their active round", () => {
    const state = {
      ...baseState,
      you: {
        ...baseState.you,
        active_from_round: 1,
      },
    } satisfies MusicQuizHitsterPersonalizedState;
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound: baseRound,
        busy: false,
      },
    });

    expect(wrapper.text()).toContain("providers.music_quiz.waiting_for_next");
    expect(wrapper.findComponent(TimelineDisplay).exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("restores the server-locked placement and completion state", () => {
    const state = stateWithAnswer([], true);
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound: baseRound,
        busy: false,
      },
    });
    const timeline = wrapper.getComponent(TimelineDisplay);

    expect(timeline.props("disabled")).toBe(true);
    expect(timeline.props("selectedPreviousEntryId")).toBe("anchor");
    expect(timeline.props("selectedNextEntryId")).toBeNull();
    expect(wrapper.text()).toContain("providers.music_quiz.answered");
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.timeline_finish_answer",
    );
  });

  it("needs no follow-up action when both bonus modes are off", () => {
    const state = {
      ...baseState,
      players: [
        {
          ...player,
          answered: true,
          placed: true,
        },
      ],
      you: {
        ...baseState.you,
        answer: {
          previous_entry_id: "anchor",
          next_entry_id: null,
          answered_at: 10,
          bonuses: [],
          finished: true,
        },
      },
    } satisfies MusicQuizHitsterPersonalizedState;
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound: baseRound,
        busy: false,
      },
    });

    expect(wrapper.text()).toContain("providers.music_quiz.answered");
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.timeline_skip_and_finish",
    );
  });

  it("runs text and choice bonuses in order before explicit finish", async () => {
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: stateWithAnswer(),
        currentRound: bonusRound,
        busy: false,
      },
      global: {
        stubs: {
          MusicQuizCountdown: true,
          TimelineDisplay: true,
          TimelineProgress: true,
        },
      },
    });

    await wrapper.get("input").setValue("  Massive Attack  ");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")?.[0]).toEqual([
      {
        answer_type: "timeline",
        action: "bonus_text",
        bonus_type: "artist",
        value: "Massive Attack",
      },
    ]);

    const artistAnswer = {
      action: "bonus_text",
      bonus_type: "artist",
      value: "Massive Attack",
    } as const;
    await wrapper.setProps({
      state: stateWithAnswer([artistAnswer]),
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("Title B"))
      ?.trigger("click");
    expect(wrapper.emitted("submit")?.[1]).toEqual([
      {
        answer_type: "timeline",
        action: "bonus_choice",
        bonus_type: "title",
        option_id: "title-b",
      },
    ]);

    const titleAnswer = {
      action: "bonus_choice",
      bonus_type: "title",
      option_id: "title-b",
    } as const;
    await wrapper.setProps({
      state: stateWithAnswer([artistAnswer, titleAnswer]),
    });
    await wrapper
      .findAll("button")
      .find((button) =>
        button.text().includes("providers.music_quiz.timeline_finish_answer"),
      )
      ?.trigger("click");
    expect(wrapper.emitted("submit")?.[2]).toEqual([
      {
        answer_type: "timeline",
        action: "finish",
      },
    ]);
  });

  it("allows finishing immediately to skip configured bonuses", async () => {
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: stateWithAnswer(),
        currentRound: bonusRound,
        busy: false,
      },
      global: {
        stubs: {
          MusicQuizCountdown: true,
          TimelineDisplay: true,
          TimelineProgress: true,
        },
      },
    });

    await wrapper
      .findAll("button")
      .find((button) =>
        button.text().includes("providers.music_quiz.timeline_skip_and_finish"),
      )
      ?.trigger("click");

    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          answer_type: "timeline",
          action: "finish",
        },
      ],
    ]);
  });

  it("disables every active bonus control while a submission is pending", () => {
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: stateWithAnswer(),
        currentRound: bonusRound,
        busy: true,
      },
      global: {
        stubs: {
          MusicQuizCountdown: true,
          TimelineDisplay: true,
          TimelineProgress: true,
        },
      },
    });

    expect(wrapper.get("input").attributes()).toHaveProperty("disabled");
    expect(
      wrapper
        .findAll("button")
        .every((button) => "disabled" in button.attributes()),
    ).toBe(true);
  });

  it("shows revealed placement and bonus correctness with points", () => {
    const revealedEntry = {
      ...anchor,
      entry_id: "current",
      release_year: 2000,
      title: "Revealed Song",
      is_anchor: false,
    };
    const currentRound = {
      ...bonusRound,
      timeline: [anchor, revealedEntry],
      revealed_entry: revealedEntry,
      answer_label: "Known Artist - Revealed Song",
      track_uri: "library://track/current",
      image_url: null,
      duration: 180,
      ended_at: 20,
    } satisfies MusicQuizHitsterRound;
    const state = {
      ...stateWithAnswer([], true),
      phase: "reveal",
      current_round: currentRound,
      you: {
        ...stateWithAnswer([], true).you,
        answer: {
          ...stateWithAnswer([], true).you.answer!,
          correct: true,
          points: 1000,
          bonus_results: [
            {
              bonus_type: "artist",
              correct: true,
              points: 250,
            },
          ],
        },
      },
    } satisfies MusicQuizHitsterPersonalizedState;
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound,
        busy: false,
      },
    });

    expect(wrapper.text()).toContain(
      "providers.music_quiz.timeline_correct_placement",
    );
    expect(wrapper.text()).toContain("+1000");
    expect(wrapper.text()).toContain("+250");
    expect(wrapper.find(".sr-only").text()).toContain(
      "providers.music_quiz.correct",
    );
  });

  it("does not mark a late joiner as missing a reveal answer", () => {
    const currentRound = {
      ...baseRound,
      ended_at: 20,
    } satisfies MusicQuizHitsterRound;
    const state = {
      ...baseState,
      phase: "reveal",
      current_round: currentRound,
      you: {
        ...baseState.you,
        active_from_round: 1,
      },
    } satisfies MusicQuizHitsterPersonalizedState;
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound,
        busy: false,
      },
    });

    expect(wrapper.text()).toContain("providers.music_quiz.waiting_for_next");
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.no_answer_submitted",
    );
  });

  it("does not render unrevealed song fields while answering", () => {
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: stateWithAnswer(),
        currentRound: bonusRound,
        busy: false,
      },
      global: {
        stubs: {
          MusicQuizCountdown: true,
          TimelineProgress: true,
        },
      },
    });

    expect(wrapper.text()).not.toContain("Revealed Song");
    expect(wrapper.html()).not.toContain("library://track/current");
  });
});
