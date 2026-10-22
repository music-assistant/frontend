import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import type { MusicQuizTimelinePersonalizedState } from "@/composables/music-quiz/useMusicQuiz";
import {
  baseRound,
  baseState,
  bonusRound,
  player,
  stateWithAnswer,
} from "./timelinePlayerFixtures";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

describe("Timeline player bonus flow", () => {
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
    } satisfies MusicQuizTimelinePersonalizedState;
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state,
        currentRound: baseRound,
        busy: false,
      },
      global: {
        stubs: {
          MusicQuizCountdown: true,
          TimelineProgress: true,
        },
      },
    });

    expect(wrapper.text()).toContain("providers.music_quiz.answered");
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.timeline_skip_remaining_bonuses",
    );
  });

  it("runs bonuses in order and accepts final server completion", async () => {
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

    const followUp = wrapper.get('[data-testid="timeline-post-placement"]');
    expect(
      wrapper
        .get('button[data-selected="true"]')
        .element.closest("li")
        ?.contains(followUp.element),
    ).toBe(true);

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
      state: stateWithAnswer([artistAnswer, titleAnswer], true),
    });

    expect(wrapper.text()).toContain("providers.music_quiz.answered");
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.timeline_skip_remaining_bonuses",
    );
    expect(wrapper.emitted("submit")).toHaveLength(2);
  });

  it("suppresses bonuses after a wrong placement is server-finished", () => {
    const wrapper = mount(TimelinePlayerAnswer, {
      props: {
        state: stateWithAnswer([], true),
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

    expect(wrapper.text()).toContain("providers.music_quiz.answered");
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.timeline_artist_bonus",
    );
    expect(wrapper.text()).not.toContain(
      "providers.music_quiz.timeline_skip_remaining_bonuses",
    );
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
          TimelineProgress: true,
        },
      },
    });

    const skipButton = wrapper
      .findAll("button")
      .find((button) =>
        button
          .text()
          .includes("providers.music_quiz.timeline_skip_remaining_bonuses"),
      );
    expect(skipButton).toBeDefined();
    await skipButton?.trigger("click");

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
});
