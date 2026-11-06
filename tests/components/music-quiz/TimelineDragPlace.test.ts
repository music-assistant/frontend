import TimelineDragPlace from "@/components/music-quiz/answer-types/timeline/TimelineDragPlace.vue";
import type { MusicQuizTimelineEntry } from "@/composables/music-quiz/useMusicQuiz";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values: unknown[] = []) =>
    values.length ? `${key}:${values.join(",")}` : key,
}));

// helpers/utils transitively imports router/auth, which need a real browser
vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

function entry(id: string, year: number): MusicQuizTimelineEntry {
  return {
    entry_id: id,
    release_year: year,
    title: `Song ${id}`,
    artist: `Artist ${id}`,
    track_uri: `library://track/${id}`,
    image_url: null,
    is_anchor: false,
  };
}

const ENTRIES = [entry("a", 1996), entry("b", 2015)];

const SONG = '[data-testid="timeline-drag-song"]';
const SPACE = '[data-testid="timeline-space"]';
const AFTER_SONG = '[data-testid="after-song"]';

enableAutoUnmount(afterEach);

describe("TimelineDragPlace", () => {
  it("starts the song at the top with the drag hint", () => {
    const wrapper = mountPlace();

    expect(rowKinds(wrapper)).toEqual(["song", "entry", "entry", "end"]);
    expect(wrapper.get(SONG).text()).toContain(
      "providers.music_quiz.timeline_drag_hint",
    );
    expect(wrapper.get(SONG).attributes("tabindex")).toBe("0");
    expect(wrapper.emitted()).not.toHaveProperty("update:position");
    expect(wrapper.emitted()).not.toHaveProperty("lock");
  });

  it("shows a gap at the top, between the songs and at the bottom", async () => {
    const wrapper = mountPlace();
    const gaps = wrapper.findAll('[data-testid="timeline-gap"]');

    expect(gaps).toHaveLength(3);
    await gaps[0]!.trigger("click");
    await gaps[1]!.trigger("click");
    await gaps[2]!.trigger("click");
    expect(wrapper.emitted("update:position")).toEqual([[0], [1], [2]]);
  });

  it("drops the gaps once the song is placed or the spaces open", async () => {
    const wrapper = mountPlace({ position: 1 });
    expect(wrapper.find('[data-testid="timeline-gap"]').exists()).toBe(false);

    await wrapper.setProps({ position: null });
    expect(wrapper.findAll('[data-testid="timeline-gap"]')).toHaveLength(3);
    await wrapper.get(SONG).trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(wrapper.find('[data-testid="timeline-gap"]').exists()).toBe(false);
  });

  it("grows the gap the waiting song is dragged over, not when it's pulled aside", async () => {
    const wrapper = mountPlace();
    const pointer = { button: 0, isPrimary: true, pointerId: 1, buttons: 1 };
    const grown = () =>
      wrapper
        .findAll('[data-testid="timeline-gap"]')
        .map((gap) => gap.classes().includes("h-(--timeline-song-height)"));

    await wrapper
      .get(SONG)
      .trigger("pointerdown", { ...pointer, clientX: 0, clientY: 0 });
    // Without layout every song's middle is 0, so a drag down passes them
    // all and the bottom gap grows.
    window.dispatchEvent(
      new PointerEvent("pointermove", { ...pointer, clientX: 0, clientY: 30 }),
    );
    await nextTick();
    expect(grown()).toEqual([false, false, true]);

    window.dispatchEvent(
      new PointerEvent("pointermove", {
        ...pointer,
        clientX: 300,
        clientY: 30,
      }),
    );
    await nextTick();
    expect(grown()).toEqual([false, false, false]);

    window.dispatchEvent(new PointerEvent("pointerup", pointer));
    await flushPromises();
  });

  it("ignores a gap tap while a dropped song is still landing", async () => {
    const wrapper = mountPlace();
    wrapper.get(SONG).element.parentElement!.dataset.dragging = "true";

    await wrapper.get('[data-testid="timeline-gap"]').trigger("click");

    expect(wrapper.emitted()).not.toHaveProperty("update:position");
  });

  it.each([
    { from: null, key: "ArrowUp", to: 0 },
    { from: null, key: "ArrowDown", to: 1 },
    { from: 1, key: "ArrowUp", to: 0 },
    { from: 1, key: "ArrowDown", to: 2 },
    { from: 0, key: "ArrowUp", to: 0 },
    { from: 2, key: "ArrowDown", to: 2 },
  ])(
    "moves the song from $from to gap $to on $key",
    async ({ from, key, to }) => {
      const wrapper = mountPlace({ position: from });

      await wrapper.get(SONG).trigger("keydown", { key });

      expect(wrapper.emitted("update:position")).toEqual([[to]]);
    },
  );

  it("opens a space in every gap on Enter and focuses the first", async () => {
    const wrapper = mountPlace();
    const song = wrapper.get(SONG);

    await song.trigger("keydown", { key: "Enter" });
    await flushPromises();

    const spaces = wrapper.findAll(SPACE);
    expect(spaces).toHaveLength(ENTRIES.length + 1);
    expect(spaces[0].attributes("aria-label")).toBe(
      "providers.music_quiz.timeline_place_before:1996,Song a",
    );
    expect(document.activeElement).toBe(spaces[0].element);
    expect(song.attributes("aria-expanded")).toBe("true");
    expect(song.text()).toContain("providers.music_quiz.timeline_tap_hint");
    expect(wrapper.emitted()).not.toHaveProperty("update:position");
  });

  it("opens spaces on a tap, except where a placed song already sits", async () => {
    const wrapper = mountPlace({ position: 1 });

    await tapSong(wrapper);

    expect(wrapper.emitted()).not.toHaveProperty("update:position");
    expect(rowKinds(wrapper)).toEqual([
      "space",
      "entry",
      "song",
      "entry",
      "space",
    ]);
  });

  it("places the song in the tapped space and closes the spaces", async () => {
    const wrapper = mountPlace();
    await openSpaces(wrapper);

    await wrapper.findAll(SPACE)[2].trigger("click");
    await flushPromises();

    expect(wrapper.emitted("update:position")).toEqual([[2]]);
    expect(wrapper.findAll(SPACE)).toHaveLength(0);
    expect(wrapper.get(SONG).attributes("aria-expanded")).toBe("false");
    // the keyboard stays on the song rather than a space that went away
    expect(document.activeElement).toBe(wrapper.get(SONG).element);
  });

  it("locks a placed song in on Enter", async () => {
    const wrapper = mountPlace({ position: 1 });

    await wrapper.get(SONG).trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("lock")).toEqual([[]]);
    expect(wrapper.emitted()).not.toHaveProperty("update:position");
    expect(wrapper.findAll(SPACE)).toHaveLength(0);
  });

  it("takes a locked song out of the tab order and shows what follows it", async () => {
    const wrapper = mountPlace({ position: 1 });
    expect(wrapper.find(AFTER_SONG).exists()).toBe(false);

    await wrapper.setProps({ locked: true });
    const song = wrapper.get(SONG);

    expect(song.attributes("tabindex")).toBeUndefined();
    expect(song.attributes("role")).toBeUndefined();
    expect(wrapper.find(AFTER_SONG).exists()).toBe(true);
    expect(song.text()).toContain(
      "providers.music_quiz.timeline_locked_in · providers.music_quiz.timeline_place_between_years:1996,2015",
    );

    await song.trigger("keydown", { key: "ArrowDown" });
    await song.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted()).not.toHaveProperty("update:position");
    expect(wrapper.emitted()).not.toHaveProperty("lock");
  });

  it("closes the spaces when the answer is locked", async () => {
    const wrapper = mountPlace();
    await openSpaces(wrapper);

    await wrapper.setProps({ locked: true });
    // the spaces stay closed, not just hidden while locked
    await wrapper.setProps({ locked: false });

    expect(wrapper.findAll(SPACE)).toHaveLength(0);
    expect(wrapper.get(SONG).attributes("aria-expanded")).toBe("false");
  });

  it("closes the spaces when a new round brings another timeline", async () => {
    const wrapper = mountPlace();
    await openSpaces(wrapper);

    await wrapper.setProps({
      entries: [...ENTRIES, entry("c", 2020)],
    });

    expect(wrapper.findAll(SPACE)).toHaveLength(0);
  });

  it("keeps the spaces open when a game update resends the same timeline", async () => {
    const wrapper = mountPlace();
    await openSpaces(wrapper);

    // every game update replaces the array with equal entries
    await wrapper.setProps({ entries: ENTRIES.map((item) => ({ ...item })) });

    expect(wrapper.findAll(SPACE)).toHaveLength(ENTRIES.length + 1);
    expect(wrapper.get(SONG).attributes("aria-expanded")).toBe("true");
  });

  it("names the place a placed song sits in", () => {
    const wrapper = mountPlace({ position: 1 });

    expect(wrapper.get(SONG).text()).toContain(
      "providers.music_quiz.timeline_place_between_years:1996,2015",
    );
    expect(wrapper.get(SONG).attributes("aria-label")).toBe(
      "providers.music_quiz.timeline_drag_song: providers.music_quiz.timeline_place_between_years:1996,2015",
    );
  });
});

function mountPlace(
  props: Partial<{
    entries: MusicQuizTimelineEntry[];
    position: number | null;
    locked: boolean;
    disabled: boolean;
  }> = {},
) {
  return mount(TimelineDragPlace, {
    props: {
      entries: ENTRIES,
      position: null,
      locked: false,
      disabled: false,
      ...props,
    },
    slots: { "after-song": '<div data-testid="after-song" />' },
    attachTo: document.body,
  });
}

type PlaceWrapper = ReturnType<typeof mountPlace>;

function rowKinds(wrapper: PlaceWrapper) {
  return wrapper.findAll("li").map((row) => row.attributes("data-row"));
}

/** A press that doesn't move: a tap, not a drag (no layout needed). */
async function tapSong(wrapper: PlaceWrapper) {
  const pointer = { button: 0, isPrimary: true, pointerId: 1 };
  await wrapper.get(SONG).trigger("pointerdown", pointer);
  window.dispatchEvent(new PointerEvent("pointerup", pointer));
  await flushPromises();
}

async function openSpaces(wrapper: PlaceWrapper) {
  await wrapper.get(SONG).trigger("keydown", { key: "Enter" });
  await flushPromises();
  expect(wrapper.findAll(SPACE).length).toBeGreaterThan(0);
}
