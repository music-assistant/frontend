import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import type { MusicQuizTimelineEntry } from "@/composables/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args: unknown[] = []) =>
    args.length ? `${key}:${args.join("|")}` : key,
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

const entries: MusicQuizTimelineEntry[] = [
  {
    entry_id: "older",
    release_year: 1990,
    title: "Older",
    artist: "Artist A",
    track_uri: "library://track/older",
    image_url: null,
    is_anchor: true,
  },
  {
    entry_id: "same-a",
    release_year: 2000,
    title: "Same A",
    artist: "Artist B",
    track_uri: "library://track/same-a",
    image_url: null,
    is_anchor: false,
  },
  {
    entry_id: "same-b",
    release_year: 2000,
    title: "Same B",
    artist: "Artist C",
    track_uri: "library://track/same-b",
    image_url: null,
    is_anchor: false,
  },
];

describe("TimelineDisplay", () => {
  it("emits stable neighboring IDs for every boundary", async () => {
    const wrapper = mount(TimelineDisplay, {
      props: {
        entries,
        selectable: true,
      },
    });
    const boundaries = wrapper.findAll("button");

    expect(boundaries).toHaveLength(4);
    await boundaries[0].trigger("click");
    await boundaries[2].trigger("click");
    await boundaries[3].trigger("click");

    expect(wrapper.emitted("select")).toEqual([
      [null, "older"],
      ["same-a", "same-b"],
      ["same-b", null],
    ]);
  });

  it("styles every available boundary as a spaced primary action", () => {
    const wrapper = mount(TimelineDisplay, {
      props: {
        entries,
        selectable: true,
      },
    });
    const boundaryItems = wrapper
      .findAll("li")
      .filter((item) => item.find("button").exists());

    expect(boundaryItems).toHaveLength(4);
    for (const item of boundaryItems) {
      expect(item.classes()).toContain("py-2");
      expect(item.classes()).not.toContain("-my-1");

      const button = item.get("button");
      expect(button.classes()).toContain("bg-primary");
      expect(button.classes()).not.toContain("bg-background");
      expect(button.attributes("aria-pressed")).toBe("false");
    }
  });

  it("keeps equal-year entries distinct and labels their exact boundary", () => {
    const wrapper = mount(TimelineDisplay, {
      props: {
        entries,
        selectable: true,
      },
    });

    expect(
      wrapper
        .findAll("article")
        .map((card) => card.attributes("data-entry-id")),
    ).toEqual(["older", "same-a", "same-b"]);
    expect(wrapper.findAll("button")[2].attributes("aria-label")).toContain(
      "2000|Same A|2000|Same B",
    );
  });

  it("restores and disables a locked boundary accessibly", () => {
    const wrapper = mount(TimelineDisplay, {
      props: {
        entries,
        selectable: true,
        disabled: true,
        selectedPreviousEntryId: "same-a",
        selectedNextEntryId: "same-b",
      },
    });
    const buttons = wrapper.findAll("button");
    const selected = buttons[2];

    expect(selected.attributes("aria-pressed")).toBe("true");
    expect(buttons.every((button) => "disabled" in button.attributes())).toBe(
      true,
    );
    expect(selected.classes()).toContain("min-h-11");
    expect(selected.classes()).toContain("bg-primary");
    expect(selected.text()).toContain(
      "providers.music_quiz.timeline_placed_here",
    );
    expect(selected.find("svg").exists()).toBe(true);
  });

  it("renders a read-only timeline without placement controls", () => {
    const wrapper = mount(TimelineDisplay, {
      props: {
        entries,
        highlightedEntryId: "same-b",
      },
    });

    expect(wrapper.find("button").exists()).toBe(false);
    expect(
      wrapper
        .find('article[data-entry-id="same-b"]')
        .classes()
        .includes("border-primary"),
    ).toBe(true);
  });

  it("renders a compact chronological strip with horizontal overflow", () => {
    const wrapper = mount(TimelineDisplay, {
      props: {
        entries,
        highlightedEntryId: "same-b",
        horizontal: true,
        compact: true,
      },
    });
    const display = wrapper.get('[data-orientation="horizontal"]');
    const list = display.get("ol");
    const cards = display.findAll("article");

    expect(display.classes()).toEqual(
      expect.arrayContaining([
        "min-w-0",
        "overflow-x-auto",
        "overscroll-x-contain",
      ]),
    );
    expect(list.classes()).toEqual(
      expect.arrayContaining(["w-max", "min-w-full", "flex-row"]),
    );
    expect(cards.map((card) => card.attributes("data-entry-id"))).toEqual([
      "older",
      "same-a",
      "same-b",
    ]);
    expect(
      cards.every((card) => card.attributes("data-compact") === "true"),
    ).toBe(true);
    expect(
      cards.every((card) =>
        card.classes().includes("grid-cols-[3rem_minmax(0,1fr)]"),
      ),
    ).toBe(true);
    expect(
      display
        .find('article[data-entry-id="same-b"]')
        .classes()
        .includes("border-primary"),
    ).toBe(true);
    expect(
      display
        .findAll("li")
        .filter((item) => item.find("article").exists())
        .every((item) => item.classes().includes("shrink-0")),
    ).toBe(true);
  });

  it("never offers the invalid null-to-null boundary", () => {
    const wrapper = mount(TimelineDisplay, {
      props: {
        entries: [],
        selectable: true,
      },
    });

    expect(wrapper.find("button").exists()).toBe(false);
  });
});
