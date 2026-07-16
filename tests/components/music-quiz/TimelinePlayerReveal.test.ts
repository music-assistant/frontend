import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import type {
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import {
  anchor,
  baseRound,
  baseState,
  bonusRound,
  stateWithAnswer,
} from "./timelinePlayerFixtures";
import { mount, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

describe("Timeline player reveal", () => {
  it("shows placement and bonus correctness with points", () => {
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
    } satisfies MusicQuizTimelineRound;
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
    } satisfies MusicQuizTimelinePersonalizedState;
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

  it("does not mark a late joiner as missing an answer", () => {
    const currentRound = {
      ...baseRound,
      ended_at: 20,
    } satisfies MusicQuizTimelineRound;
    const state = {
      ...baseState,
      phase: "reveal",
      current_round: currentRound,
      you: {
        ...baseState.you,
        active_from_round: 1,
      },
    } satisfies MusicQuizTimelinePersonalizedState;
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
