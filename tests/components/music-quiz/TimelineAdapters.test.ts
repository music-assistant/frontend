import TimelineBoard from "@/components/music-quiz/answer-types/timeline/TimelineBoard.vue";
import TimelineHostAnswer from "@/components/music-quiz/answer-types/timeline/TimelineHostAnswer.vue";
import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import TimelinePresentAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePresentAnswer.vue";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import type {
  MusicQuizHitsterHostState,
  MusicQuizHitsterPersonalizedState,
  MusicQuizTimelineBonusDefinition,
  MusicQuizTimelineEntry,
  MusicQuizTimelineRound,
  MusicQuizTimelineYourAnswer,
} from "@/composables/useMusicQuiz";
import { getMusicQuizRoundScoreLabel } from "@/helpers/music_quiz";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args?.length ? `${key}:${args.join(",")}` : key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

const timeline = [
  timelineEntry("first", 1980, "First"),
  timelineEntry("same-year", 1980, "Same year"),
  timelineEntry("last", 2000, "Last"),
];

describe("timeline answer adapters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders every stable insertion boundary, including equal-year neighbors", async () => {
    const wrapper = mount(TimelineBoard, {
      props: {
        timeline,
        interactive: true,
      },
    });
    const buttons = wrapper.findAll("[data-boundary-key]");

    expect(
      buttons.map((button) => button.attributes("data-boundary-key")),
    ).toEqual(["start:first", "first:same-year", "same-year:last", "last:end"]);
    expect(buttons[1].text()).toContain("1980,1980");
    expect(buttons[0].attributes("aria-label")).toBeUndefined();
    expect(buttons[0].text()).toContain(
      "providers.music_quiz.timeline_place_at_start",
    );
    expect(buttons[0].text()).toContain(
      "providers.music_quiz.timeline_place_before",
    );
    expect(wrapper.get('[role="region"]').attributes("aria-label")).toContain(
      "providers.music_quiz.timeline",
    );

    for (const button of buttons) await button.trigger("click");
    expect(wrapper.emitted("select")).toEqual([
      [{ previous_entry_id: null, next_entry_id: "first" }],
      [{ previous_entry_id: "first", next_entry_id: "same-year" }],
      [{ previous_entry_id: "same-year", next_entry_id: "last" }],
      [{ previous_entry_id: "last", next_entry_id: null }],
    ]);
    wrapper.unmount();
  });

  it("makes a read-only overflowing timeline keyboard scrollable", () => {
    const wrapper = mount(TimelineBoard, { props: { timeline } });

    expect(wrapper.get('[role="region"]').attributes("tabindex")).toBe("0");
    expect(wrapper.find("[data-boundary-key]").exists()).toBe(false);
    wrapper.unmount();
  });

  it("locks the first placement immediately and prevents duplicates", async () => {
    const round = timelineRound();
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: playerState(round),
        currentRound: round,
        busy: false,
      },
    });
    const boundary = wrapper.get('[data-boundary-key="first:same-year"]');

    await boundary.trigger("click");
    await wrapper.get('[data-boundary-key="last:end"]').trigger("click");

    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          answer_type: "timeline",
          action: "place",
          previous_entry_id: "first",
          next_entry_id: "same-year",
        },
      ],
    ]);
    expect(
      wrapper
        .get('[data-boundary-key="first:same-year"]')
        .attributes("aria-pressed"),
    ).toBe("true");
    expect(wrapper.get('[role="region"]').attributes("tabindex")).toBe("0");
    expect(
      wrapper
        .findAll("[data-boundary-key]")
        .every((button) => button.attributes("disabled") !== undefined),
    ).toBe(true);
    wrapper.unmount();
  });

  it("restores a reconnect placement and unlocks a failed optimistic attempt", async () => {
    const round = timelineRound();
    const restoredAnswer = timelineAnswer({
      previous_entry_id: "same-year",
      next_entry_id: "last",
    });
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: playerState(round, restoredAnswer),
        currentRound: round,
        busy: false,
      },
    });

    expect(
      wrapper
        .get('[data-boundary-key="same-year:last"]')
        .attributes("aria-pressed"),
    ).toBe("true");

    const freshState = playerState(round);
    await wrapper.setProps({ state: freshState });
    await wrapper.get('[data-boundary-key="start:first"]').trigger("click");
    await wrapper.setProps({ busy: true });
    await wrapper.setProps({ busy: false });

    expect(
      wrapper
        .get('[data-boundary-key="start:first"]')
        .attributes("aria-pressed"),
    ).toBe("false");
    expect(
      wrapper
        .findAll("[data-boundary-key]")
        .some((button) => button.attributes("disabled") === undefined),
    ).toBe(true);
    wrapper.unmount();
  });

  it("keeps late joiners read-only until their first active round", async () => {
    const round = timelineRound();
    const state = playerState(round);
    state.you.active_from_round = 1;
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound: round,
        busy: false,
      },
    });

    expect(wrapper.find("[data-boundary-key]").exists()).toBe(false);
    expect(wrapper.text()).toContain(
      "providers.music_quiz.timeline_join_next_round",
    );

    await wrapper.setProps({ state: { ...state, phase: "reveal" } });
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.no_answer_submitted",
    );
    expect(wrapper.text()).toContain(
      "providers.music_quiz.timeline_join_next_round",
    );
    wrapper.unmount();
  });

  it("submits free-text and opaque choice bonuses independently", async () => {
    const definitions: MusicQuizTimelineBonusDefinition[] = [
      { bonus_type: "artist", mode: "free_text" },
      {
        bonus_type: "title",
        mode: "multiple_choice",
        options: [
          { option_id: "opaque-a", label: "Option A" },
          { option_id: "opaque-b", label: "Option B" },
        ],
      },
    ];
    const round = timelineRound(definitions);
    const placement = timelineAnswer();
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: playerState(round, placement),
        currentRound: round,
        busy: false,
      },
    });

    await wrapper.get("#timeline-artist-bonus").setValue("  The Artist  ");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")?.[0]).toEqual([
      {
        answer_type: "timeline",
        action: "bonus_text",
        bonus_type: "artist",
        value: "The Artist",
      },
    ]);

    const artistAnswer = timelineAnswer({
      bonuses: [
        {
          action: "bonus_text",
          bonus_type: "artist",
          value: "The Artist",
        },
      ],
    });
    await wrapper.setProps({ state: playerState(round, artistAnswer) });
    await wrapper.get('[data-option-id="opaque-b"]').trigger("click");

    expect(wrapper.emitted("submit")?.[1]).toEqual([
      {
        answer_type: "timeline",
        action: "bonus_choice",
        bonus_type: "title",
        option_id: "opaque-b",
      },
    ]);
    wrapper.unmount();
  });

  it("allows skipping bonuses with Finish and omits Finish when bonuses are off", async () => {
    const bonusRound = timelineRound([
      { bonus_type: "artist", mode: "free_text" },
    ]);
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: playerState(bonusRound, timelineAnswer()),
        currentRound: bonusRound,
        busy: false,
      },
    });
    const finishButton = wrapper
      .findAll("button")
      .find((button) =>
        button.text().includes("providers.music_quiz.timeline_finish_answer"),
      );

    await finishButton?.trigger("click");
    await finishButton?.trigger("click");
    expect(wrapper.emitted("submit")).toEqual([
      [{ answer_type: "timeline", action: "finish" }],
    ]);
    wrapper.unmount();

    const noBonusRound = timelineRound();
    const noBonusWrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: playerState(noBonusRound, timelineAnswer({ finished: true })),
        currentRound: noBonusRound,
        busy: false,
      },
    });
    expect(noBonusWrapper.text()).not.toContain(
      "providers.music_quiz.timeline_finish_answer",
    );
    expect(noBonusWrapper.text()).toContain("providers.music_quiz.answered");
    noBonusWrapper.unmount();
  });

  it("shows countdown, public completion progress, and reveal points", () => {
    const definitions: MusicQuizTimelineBonusDefinition[] = [
      { bonus_type: "artist", mode: "free_text" },
      { bonus_type: "title", mode: "free_text" },
    ];
    const round = timelineRound(definitions);
    const answeringWrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: playerState(round),
        currentRound: round,
        busy: false,
      },
    });

    expect(answeringWrapper.text()).toContain("30s");
    expect(
      answeringWrapper.getComponent(TimelineProgress).props("statuses"),
    ).toHaveLength(1);
    answeringWrapper.unmount();

    const revealedRound = {
      ...round,
      timeline: [...timeline, timelineEntry("revealed", 1990, "Revealed")],
      revealed_entry: timelineEntry("revealed", 1990, "Revealed"),
      answer_label: "Artist - Revealed",
      track_uri: "library://track/revealed",
      image_url: null,
      duration: 180,
      ended_at: 20,
    } satisfies MusicQuizTimelineRound;
    const revealedAnswer = timelineAnswer({
      finished: true,
      correct: true,
      points: 500,
      bonus_results: [{ bonus_type: "artist", correct: true, points: 250 }],
    });
    const revealWrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: {
          ...playerState(revealedRound, revealedAnswer),
          phase: "reveal",
        },
        currentRound: revealedRound,
        busy: false,
      },
    });

    expect(revealWrapper.text()).toContain(
      "providers.music_quiz.timeline_correct_placement",
    );
    expect(revealWrapper.text()).toContain("+500");
    expect(revealWrapper.text()).toContain("+250");
    expect(revealWrapper.text()).toContain(
      "providers.music_quiz.timeline_bonus_skipped",
    );
    revealWrapper.unmount();
  });

  it("shows safe progress in host and present adapters", () => {
    const round = timelineRound();
    const state = hostState(round);
    const hostWrapper = mount(TimelineHostAnswer, {
      props: { state, currentRound: round },
      slots: { leaderboard: '<div data-testid="leaderboard" />' },
    });
    const presentWrapper = mount(TimelinePresentAnswer, {
      props: { state, currentRound: round },
      slots: { leaderboard: '<div data-testid="leaderboard" />' },
    });

    expect(hostWrapper.text()).toContain("30s");
    expect(
      hostWrapper.getComponent(TimelineProgress).props("statuses"),
    ).toEqual(state.players);
    expect(hostWrapper.find('[data-testid="leaderboard"]').exists()).toBe(true);
    expect(presentWrapper.text()).toContain("30s");
    expect(presentWrapper.find('[data-testid="leaderboard"]').exists()).toBe(
      true,
    );

    hostWrapper.unmount();
    presentWrapper.unmount();
  });

  it("includes placement and both bonus scores in leaderboard feedback", () => {
    const round = {
      ...timelineRound(),
      timeline,
      revealed_entry: timeline[1],
      answer_label: "Same year Artist - Same year",
      track_uri: timeline[1].track_uri,
      image_url: null,
      duration: 180,
      ended_at: 20,
    } satisfies MusicQuizTimelineRound;
    const state = playerState(round);
    state.phase = "reveal";
    state.players[0].last_answer = {
      placement: {
        previous_entry_id: "first",
        next_entry_id: "same-year",
        correct: true,
        points: 500,
      },
      artist: { correct: true, points: 250 },
      title: { correct: false, points: 0 },
    };

    expect(getMusicQuizRoundScoreLabel(state, "Player")).toBe("(+750)");
  });
});

function timelineEntry(
  entryId: string,
  releaseYear: number,
  title: string,
): MusicQuizTimelineEntry {
  return {
    entry_id: entryId,
    release_year: releaseYear,
    title,
    artist: `${title} Artist`,
    track_uri: `library://track/${entryId}`,
    image_url: null,
    is_anchor: entryId === "first",
  };
}

function timelineRound(
  bonusDefinitions: MusicQuizTimelineBonusDefinition[] = [],
): MusicQuizTimelineRound {
  return {
    round_index: 0,
    started_at: Date.now() / 1000,
    deadline: Date.now() / 1000 + 30,
    question: null,
    timeline,
    bonus_definitions: bonusDefinitions,
  };
}

function timelineAnswer(
  overrides: Partial<MusicQuizTimelineYourAnswer> = {},
): MusicQuizTimelineYourAnswer {
  return {
    previous_entry_id: "first",
    next_entry_id: "same-year",
    answered_at: Date.now() / 1000,
    bonuses: [],
    finished: false,
    ...overrides,
  };
}

function playerState(
  round: MusicQuizTimelineRound,
  answer?: MusicQuizTimelineYourAnswer,
): MusicQuizHitsterPersonalizedState {
  return {
    quiz_type: "hitster",
    answer_type: "timeline",
    phase: "answering",
    name: "Timeline Quiz",
    round_count: 5,
    answer_duration: 30,
    artist_bonus_mode: "free_text",
    title_bonus_mode: "multiple_choice",
    mode: "venue",
    players: [
      {
        name: "Player",
        score: 0,
        ready: false,
        answered: answer?.finished ?? false,
        placed: !!answer,
        artist_bonus_answered:
          answer?.bonuses.some((bonus) => bonus.bonus_type === "artist") ??
          false,
        title_bonus_answered:
          answer?.bonuses.some((bonus) => bonus.bonus_type === "title") ??
          false,
      },
    ],
    current_round: round,
    you: {
      name: "Player",
      score: 0,
      ready: false,
      active_from_round: 0,
      ...(answer ? { answer } : {}),
    },
  };
}

function hostState(round: MusicQuizTimelineRound): MusicQuizHitsterHostState {
  const personalized = playerState(round);
  return {
    ...personalized,
    players: personalized.players,
    created_at: 1,
    sources: [],
    join_url: "https://example.test/join",
    rounds: [],
  };
}
