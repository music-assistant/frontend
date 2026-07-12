import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import type { MusicQuizTimelineRound } from "@/composables/useMusicQuiz";
import {
  anchor,
  baseRound,
  baseState,
  bonusRound,
  stateWithAnswer,
} from "./timelinePlayerFixtures";
import { mount, shallowMount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  setReducedMotion(false);
});

describe("Timeline player focus", () => {
  it("does not steal focus when restoring a locked answer", () => {
    const wrapper = shallowMount(TimelinePlayerAnswer, {
      props: {
        state: stateWithAnswer([], true),
        currentRound: baseRound,
        busy: false,
      },
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("moves and focuses bonus controls before a long timeline", async () => {
    const longRound = {
      ...bonusRound,
      timeline: Array.from({ length: 100 }, (_, index) => ({
        ...anchor,
        entry_id: `entry-${index}`,
        release_year: 1900 + index,
        title: `Song ${index}`,
        track_uri: `library://track/${index}`,
        is_anchor: index === 0,
      })),
    } satisfies MusicQuizTimelineRound;
    const wrapper = mount(TimelinePlayerAnswer, {
      attachTo: document.body,
      props: {
        state: baseState,
        currentRound: longRound,
        busy: false,
      },
      global: {
        stubs: {
          MusicQuizCountdown: true,
          TimelineProgress: true,
        },
      },
    });

    await wrapper.setProps({
      state: stateWithAnswer(),
      busy: true,
    });
    await nextTick();
    expect(scrollIntoView).not.toHaveBeenCalled();

    await wrapper.setProps({ busy: false });
    await nextTick();

    const controls = wrapper.get('[data-testid="timeline-post-placement"]');
    const timeline = wrapper.get(
      'ol[aria-label="providers.music_quiz.timeline"]',
    );
    expect(
      controls.element.compareDocumentPosition(timeline.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.activeElement).toBe(wrapper.get("input").element);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    wrapper.unmount();
  });

  it("focuses the next action without smooth scrolling when motion is reduced", async () => {
    setReducedMotion(true);
    const artistAnswer = {
      action: "bonus_text",
      bonus_type: "artist",
      value: "Massive Attack",
    } as const;
    const wrapper = mount(TimelinePlayerAnswer, {
      attachTo: document.body,
      props: {
        state: baseState,
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

    await wrapper.setProps({
      state: stateWithAnswer([artistAnswer]),
    });
    await nextTick();

    expect((document.activeElement as HTMLElement).textContent).toContain(
      "Title A",
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
    wrapper.unmount();
  });
});

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
