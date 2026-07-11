import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import type { MusicQuizTimelinePersonalizedState } from "@/composables/useMusicQuiz";
import { baseRound, baseState, player } from "./timelinePlayerFixtures";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

describe("Timeline player placement", () => {
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
    } satisfies MusicQuizTimelinePersonalizedState;
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

  it("excludes late joiners from player progress totals", () => {
    const state = {
      ...baseState,
      players: [
        player,
        {
          ...player,
          name: "Late",
          active_from_round: 1,
        },
      ],
    } satisfies MusicQuizTimelinePersonalizedState;
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound: baseRound,
        busy: false,
      },
    });

    expect(wrapper.getComponent(TimelineProgress).props("statuses")).toEqual([
      player,
    ]);
  });
});
