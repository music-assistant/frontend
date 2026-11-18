import RotationConditionChip from "@/components/rotation/RotationConditionChip.vue";
import RotationStepRow from "@/components/rotation/RotationStepRow.vue";
import type { RotationDescribe, RotationStep } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/plugins/i18n";

vi.mock("@/plugins/api", () => ({
  default: { getItemByUri: vi.fn(async () => ({ name: "Die drei ???" })) },
}));

enableAutoUnmount(afterEach);

const DESCRIBE = {
  step_types: [],
  providers: [],
  media_types: {
    artist: { fields: [], sort_keys: [] },
    album: { fields: [], sort_keys: [] },
    track: {
      fields: [
        {
          name: "title",
          type: "text",
          label: "Title",
          operators: ["is", "contains"],
          sortable: true,
        },
        {
          name: "track_number",
          type: "number",
          label: "Track number",
          operators: ["is", "between"],
          sortable: true,
        },
      ],
      sort_keys: ["random", "title", "track_number"],
    },
  },
} as unknown as RotationDescribe;

const FILTER: RotationStep = {
  type: "filter",
  mode: "remove",
  match: "any",
  conditions: [
    { field: "title", op: "contains", value: "Inhaltsangabe" },
    { field: "title", op: "contains", value: "Titelmusik" },
  ],
};

function mountRow(props: Record<string, unknown>) {
  return mount(RotationStepRow, {
    global: { plugins: [i18n] },
    props: {
      step: FILTER,
      index: 2,
      state: { kind: "track", depth: 0 },
      describe: DESCRIBE,
      errors: [],
      grouped: false,
      ...props,
    },
  });
}

describe("RotationStepRow", () => {
  it("reads the Die drei ??? filter as a sentence", () => {
    const text = mountRow({}).text();
    expect(text).toContain("Leave out");
    expect(text).toContain("Inhaltsangabe");
    expect(text).toContain("Titelmusik");
  });

  it("shows an inexact count as at least", () => {
    const wrapper = mountRow({ count: { count: 200, exact: false } });
    expect(wrapper.text()).toContain("at least 200");
  });

  it("has no remove button on the source step", () => {
    const source = mountRow({
      step: { type: "source", media_type: "album", from: "library" },
      index: 0,
      state: { kind: "album", depth: 0 },
    });
    expect(source.find("button[aria-label='Remove this step']").exists()).toBe(
      false,
    );
    expect(source.text()).toContain("Take");
    const other = mountRow({});
    expect(other.find("button[aria-label='Remove this step']").exists()).toBe(
      true,
    );
  });

  it("emits the changed step when a condition changes", () => {
    const wrapper = mountRow({});
    const chip = wrapper.findAllComponents(RotationConditionChip)[0]!;
    chip.vm.$emit("update", {
      field: "title",
      op: "is",
      value: "Teil 01",
    });
    const emitted = wrapper.emitted("update")![0]![0] as Extract<
      RotationStep,
      { type: "filter" }
    >;
    expect(emitted.conditions[0]).toEqual({
      field: "title",
      op: "is",
      value: "Teil 01",
    });
    expect(emitted.conditions[1]!.value).toBe("Titelmusik");
  });

  it("shows the errors of a step under the row", () => {
    const wrapper = mountRow({
      errors: [{ step: 3, field: null, message: "Nothing to do" }],
    });
    expect(wrapper.text()).toContain("Nothing to do");
  });

  it.each([
    ["album", "track", "Play each album's tracks"],
    ["artist", "album", "Play each artist's albums"],
    ["artist", "track", "Play each artist's tracks"],
  ] as const)(
    "reads an expand of %s to %s as one phrase",
    (kind, to, phrase) => {
      const wrapper = mountRow({
        step: { type: "expand", to, scope: "library" },
        state: { kind, depth: 0 },
      });
      expect(wrapper.text()).toContain(phrase);
    },
  );

  it.each([
    ["source", { type: "source", media_type: "album", from: "library" }],
    ["filter", FILTER],
    ["sort", { type: "sort", keys: [{ field: "title" }, { field: "random" }] }],
    ["limit", { type: "limit", minutes: 120 }],
    ["expand", { type: "expand", to: "album", scope: "library" }],
  ] as [string, RotationStep][])(
    "names every chip of the %s step with its visible text",
    (_, step) => {
      const wrapper = mountRow({
        step,
        state: { kind: step.type === "expand" ? "artist" : "track", depth: 0 },
      });
      const chips = wrapper.findAll('[role="combobox"]');
      expect(chips.length).toBeGreaterThan(0);
      for (const chip of chips) {
        const label = chip.attributes("aria-label") ?? "";
        expect(label).toContain(chip.text());
        expect(label.length).toBeGreaterThan(chip.text().length);
      }
    },
  );

  it("names the add condition button with its visible text", () => {
    const wrapper = mountRow({
      step: { type: "filter", mode: "keep", match: "all", conditions: [] },
    });
    const button = wrapper
      .findAll("button")
      .find((b) => b.text().includes("pick a condition"));
    expect(button).toBeDefined();
    expect(button!.attributes("aria-label") ?? button!.text()).toContain(
      "pick a condition",
    );
  });

  it.each([
    [
      "source",
      { type: "source", media_type: "album", from: "library" },
      "Take albums from my library",
    ],
    [
      "filter",
      FILTER,
      "Leave out where any of Title contains Inhaltsangabe or Title contains Titelmusik",
    ],
    [
      "sort",
      { type: "sort", keys: [{ field: "title" }, { field: "random" }] },
      "Order by Title ascending then randomly",
    ],
    [
      "limit of one minute",
      { type: "limit", minutes: 1 },
      "Only the first minute",
    ],
    [
      "limit of ten items",
      { type: "limit", count: 10 },
      "Only the first items",
    ],
  ] as [string, RotationStep, string][])(
    "reads the %s step as one sentence",
    (_, step, sentence) => {
      // the chips sit apart by layout gap, not by spaces in the text
      const squash = (text: string) => text.replace(/\s+/g, "");
      const text = mountRow({
        step,
        state: { kind: "track", depth: 0 },
      }).text();
      expect(squash(text)).toContain(squash(sentence));
    },
  );

  it.each([
    [{ type: "limit", minutes: 1 }, "minute"],
    [{ type: "limit", minutes: 90 }, "minutes"],
    [{ type: "limit", count: 1 }, "item"],
  ] as [RotationStep, string][])(
    "counts the unit of %j in its chip",
    (step, unit) => {
      const chip = mountRow({ step }).find('[role="combobox"]');
      expect(chip.text()).toBe(unit);
    },
  );
});
