import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import type {
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
} from "@/composables/music-quiz/useMusicQuiz";
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
  it("renders no result banners since results live in the player header", () => {
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
          correct: false,
          points: 0,
          bonus_results: [
            {
              bonus_type: "artist",
              correct: true,
              points: 250,
            },
            {
              bonus_type: "title",
              correct: false,
              points: 0,
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

    expect(
      wrapper.find('[data-testid="timeline-placement-result"]').exists(),
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="timeline-artist-result"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="timeline-title-result"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.no_answer_submitted",
    );
  });

  it("shows the revealed timeline without a line of its own for a missed answer", () => {
    const revealedEntry = {
      ...anchor,
      entry_id: "current",
      release_year: 2000,
      title: "Revealed Song",
      is_anchor: false,
    };
    const currentRound = {
      ...baseRound,
      timeline: [anchor, revealedEntry],
      revealed_entry: revealedEntry,
      ended_at: 20,
    } satisfies MusicQuizTimelineRound;
    const state = {
      ...baseState,
      phase: "reveal",
      current_round: currentRound,
    } satisfies MusicQuizTimelinePersonalizedState;
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound,
        busy: false,
      },
    });

    expect(
      wrapper.getComponent(TimelineDisplay).props("highlightedEntryId"),
    ).toBe("current");
    // The round result banner above already says no answer came in.
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
