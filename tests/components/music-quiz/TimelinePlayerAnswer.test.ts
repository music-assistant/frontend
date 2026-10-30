import TimelinePlayerAnswer from "@/components/music-quiz/answer-types/timeline/TimelinePlayerAnswer.vue";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import type {
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { anchor, baseRound, baseState, player } from "./timelinePlayerFixtures";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values?: Array<string | number>) =>
    values?.length ? `${key} ${values.join(" ")}` : key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

const SONG = '[data-testid="timeline-drag-song"]';
const LOCK_IN = '[data-testid="timeline-lock-in"]';
const SPACE = '[data-testid="timeline-space"]';

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

function mountAnswer(
  props: Partial<{
    state: MusicQuizTimelinePersonalizedState;
    currentRound: MusicQuizTimelineRound;
    busy: boolean;
  }> = {},
) {
  wrapper = mount(TimelinePlayerAnswer, {
    attachTo: document.body,
    props: {
      state: baseState,
      currentRound: baseRound,
      busy: false,
      ...props,
    },
  });
  return wrapper;
}

async function pressKey(wrapper: VueWrapper, key: string) {
  await wrapper.get(SONG).trigger("keydown", { key });
  await flushPromises();
}

function placePayload(
  previousEntryId: string | null,
  nextEntryId: string | null,
) {
  return {
    answer_type: "timeline",
    action: "place",
    previous_entry_id: previousEntryId,
    next_entry_id: nextEntryId,
  };
}

describe("Timeline player placement", () => {
  it.each([
    ["start", "ArrowUp", null, "anchor"],
    ["end", "ArrowDown", "anchor", null],
  ] as const)(
    "submits the exact %s placement once it is locked in",
    async (_label, key, previousEntryId, nextEntryId) => {
      const wrapper = mountAnswer();
      expect(wrapper.find(LOCK_IN).exists()).toBe(false);

      await pressKey(wrapper, key);

      // Moving the song is not an answer yet; Lock in makes it final.
      expect(wrapper.emitted("submit")).toBeUndefined();
      await wrapper.get(LOCK_IN).trigger("click");

      expect(wrapper.emitted("submit")).toEqual([
        [placePayload(previousEntryId, nextEntryId)],
      ]);
    },
  );

  it("places the song in a tapped space between two songs", async () => {
    const later = {
      ...anchor,
      entry_id: "later",
      release_year: 2005,
      title: "Later",
      track_uri: "library://track/later",
      is_anchor: false,
    };
    const wrapper = mountAnswer({
      currentRound: { ...baseRound, timeline: [anchor, later] },
    });

    // Enter on a song that isn't placed yet opens the spaces and moves to
    // the first one.
    await pressKey(wrapper, "Enter");
    const spaces = wrapper.findAll(SPACE);
    expect(spaces).toHaveLength(3);
    expect(document.activeElement).toBe(spaces[0].element);
    expect(wrapper.emitted("submit")).toBeUndefined();

    const between = spaces.find((space) =>
      space
        .attributes("aria-label")
        ?.includes("providers.music_quiz.timeline_place_between"),
    );
    expect(between).toBeDefined();
    await between?.trigger("click");
    await flushPromises();

    expect(wrapper.find(SPACE).exists()).toBe(false);
    expect(wrapper.emitted("submit")).toBeUndefined();
    await wrapper.get(LOCK_IN).trigger("click");

    expect(wrapper.emitted("submit")).toEqual([
      [placePayload("anchor", "later")],
    ]);
  });

  it("locks in with Enter once the song is placed", async () => {
    const wrapper = mountAnswer();

    await pressKey(wrapper, "ArrowDown");
    await pressKey(wrapper, "Enter");

    expect(wrapper.emitted("submit")).toEqual([[placePayload("anchor", null)]]);
  });

  it("keeps a pending placement locked and frees it if the submit fails", async () => {
    const wrapper = mountAnswer();
    await pressKey(wrapper, "ArrowDown");
    await wrapper.get(LOCK_IN).trigger("click");

    const song = wrapper.get(SONG);
    expect(song.attributes("role")).toBeUndefined();
    expect(song.attributes("aria-label")).toContain(
      "providers.music_quiz.timeline_locked_in",
    );
    expect(wrapper.find(LOCK_IN).exists()).toBe(false);

    // A locked song can't be moved or locked in again.
    await pressKey(wrapper, "ArrowUp");
    await pressKey(wrapper, "Enter");
    expect(wrapper.emitted("submit")).toHaveLength(1);

    // The submit ends without an answer: the song stays where it was put
    // and can be locked in again.
    await wrapper.setProps({ busy: true });
    await wrapper.setProps({ busy: false });

    expect(wrapper.get(SONG).attributes("role")).toBe("button");
    expect(wrapper.get(SONG).attributes("aria-label")).toContain(
      "providers.music_quiz.timeline_place_after_year 1990",
    );
    await wrapper.get(LOCK_IN).trigger("click");

    expect(wrapper.emitted("submit")).toEqual([
      [placePayload("anchor", null)],
      [placePayload("anchor", null)],
    ]);
  });

  it("renders no answer controls for a late joiner", () => {
    const state = {
      ...baseState,
      you: {
        ...baseState.you,
        active_from_round: 1,
      },
    } satisfies MusicQuizTimelinePersonalizedState;
    const wrapper = mountAnswer({ state });

    // The player stage shows its own "next round" notice instead.
    expect(wrapper.find('[data-testid="timeline-drag"]').exists()).toBe(false);
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).toBe("");
  });

  it("shows no round progress card on players' phones", () => {
    const state = {
      ...baseState,
      players: [
        player,
        {
          ...player,
          name: "Other",
          answered: true,
          placed: true,
        },
      ],
    } satisfies MusicQuizTimelinePersonalizedState;
    const wrapper = mountAnswer({ state });

    expect(wrapper.find('[data-testid="timeline-drag"]').exists()).toBe(true);
    expect(wrapper.findComponent(TimelineProgress).exists()).toBe(false);
  });
});
