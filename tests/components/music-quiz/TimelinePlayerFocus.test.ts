import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import type { MusicQuizTimelineRound } from "@/composables/music-quiz/useMusicQuiz";
import {
  anchor,
  baseState,
  bonusRound,
  stateWithAnswer,
} from "./timelinePlayerFixtures";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

const POST_PLACEMENT = '[data-testid="timeline-post-placement"]';
const scrollIntoView = vi.fn();
let wrapper: VueWrapper | undefined;

beforeEach(() => {
  scrollIntoView.mockReset();
  // scrollIntoView would scroll the page itself too (sliding the top bar
  // away on phones), so it must never be used.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  setReducedMotion(false);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Timeline player focus", () => {
  it("does not steal focus or scroll when restoring a locked answer", async () => {
    const area = scrollArea(document.body);
    wrapper = mount(TimelinePlayerAnswer, {
      attachTo: area.element,
      props: {
        state: stateWithAnswer(),
        currentRound: bonusRound,
        busy: false,
      },
    });
    await flushPromises();

    expect(wrapper.find(POST_PLACEMENT).exists()).toBe(true);
    expect(document.activeElement).toBe(document.body);
    expect(area.scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls only the nearest scroll area to the bonus after the song and focuses it", async () => {
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
    const answeredState = stateWithAnswer();
    if (!answeredState.you.answer) throw new Error("Expected fixture answer");
    answeredState.you.answer.previous_entry_id = "entry-99";
    const page = scrollArea(document.body);
    const area = scrollArea(page.element);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return rect(
          this.dataset.testid === "timeline-post-placement" ? 900 : 0,
        );
      },
    );
    wrapper = mount(TimelinePlayerAnswer, {
      attachTo: area.element,
      props: {
        state: baseState,
        currentRound: longRound,
        busy: false,
      },
    });

    await wrapper.setProps({
      state: answeredState,
      busy: true,
    });
    await flushPromises();
    expect(area.scrollTo).not.toHaveBeenCalled();

    await wrapper.setProps({ busy: false });
    await flushPromises();

    // The bonus sits right after the song, which went after the last song.
    const controls = wrapper.get(POST_PLACEMENT);
    const song = wrapper.get('[data-testid="timeline-drag-song"]');
    const songRow = song.element.closest("li");
    expect(songRow?.contains(controls.element)).toBe(true);
    expect(
      song.element.compareDocumentPosition(controls.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      wrapper.get('[data-testid="timeline-drag"]').element.lastElementChild,
    ).toBe(songRow);

    // The bonus area itself takes focus: no keyboard popping up for the
    // text field, and Enter can't press Skip by accident.
    expect(document.activeElement).toBe(controls.element);
    expect(area.scrollTo).toHaveBeenCalledWith({
      top: 850,
      behavior: "smooth",
    });
    expect(page.scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("focuses the next bonus without smooth scrolling when motion is reduced", async () => {
    setReducedMotion(true);
    const artistAnswer = {
      action: "bonus_text",
      bonus_type: "artist",
      value: "Massive Attack",
    } as const;
    const area = scrollArea(document.body);
    wrapper = mount(TimelinePlayerAnswer, {
      attachTo: area.element,
      props: {
        state: stateWithAnswer(),
        currentRound: bonusRound,
        busy: false,
      },
    });

    await wrapper.setProps({
      state: stateWithAnswer([artistAnswer]),
      busy: true,
    });
    await flushPromises();
    expect(area.scrollTo).not.toHaveBeenCalled();

    await wrapper.setProps({ busy: false });
    await flushPromises();

    const controls = wrapper.get(POST_PLACEMENT);
    expect(document.activeElement).toBe(controls.element);
    expect(controls.text()).toContain("Title A");
    expect(area.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "auto" }),
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("focuses the bonus area, not its text field, when nothing can scroll", async () => {
    wrapper = mount(TimelinePlayerAnswer, {
      attachTo: document.body,
      props: {
        state: baseState,
        currentRound: bonusRound,
        busy: false,
      },
    });

    await wrapper.setProps({ state: stateWithAnswer() });
    await flushPromises();

    expect(document.activeElement).toBe(wrapper.get(POST_PLACEMENT).element);
    expect(document.activeElement).not.toBe(wrapper.get("input").element);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

/** A scrollable box, like the stage's scroll area or the page around it. */
function scrollArea(parent: HTMLElement) {
  const element = document.createElement("div");
  element.style.overflowY = "auto";
  Object.defineProperty(element, "scrollHeight", { value: 2000 });
  Object.defineProperty(element, "clientHeight", { value: 500 });
  element.scrollTop = 50;
  element.getBoundingClientRect = () => rect(100);
  const scrollTo = vi.fn();
  element.scrollTo = scrollTo;
  parent.appendChild(element);
  return { element, scrollTo };
}

function rect(top: number): DOMRect {
  return {
    top,
    bottom: top,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

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
