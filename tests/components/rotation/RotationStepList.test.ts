import RotationAddStepMenu from "@/components/rotation/RotationAddStepMenu.vue";
import RotationStepList from "@/components/rotation/RotationStepList.vue";
import RotationStepRow from "@/components/rotation/RotationStepRow.vue";
import { listStates } from "@/helpers/rotation";
import type {
  RotationDescribe,
  RotationStep,
  RotationStepError,
} from "@/plugins/api/interfaces";
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
    artist: { fields: [], sort_keys: ["random"] },
    album: { fields: [], sort_keys: ["random"] },
    track: { fields: [], sort_keys: ["random"] },
  },
} as unknown as RotationDescribe;

const STEPS: RotationStep[] = [
  { type: "source", media_type: "album", from: "library" },
  { type: "sort", keys: [{ field: "random" }] },
  { type: "expand", to: "track", scope: "library" },
  { type: "limit", count: 2 },
];

function rowStates(steps: RotationStep[]) {
  const after = listStates(steps);
  return steps.map((_, index) => after[index === 0 ? 0 : index - 1]!);
}

function mountList(
  steps: RotationStep[] = STEPS,
  errors = new Map<number, RotationStepError[]>(),
) {
  return mount(RotationStepList, {
    global: { plugins: [i18n] },
    props: {
      steps,
      states: rowStates(steps),
      describe: DESCRIBE,
      counts: [],
      errors,
      canAdd: true,
    },
  });
}

describe("RotationStepList", () => {
  it("moves a step down and up with the arrow keys on its handle", async () => {
    const wrapper = mountList();
    const handle = wrapper.find('[data-drag-index="1"] [data-drag-handle]');
    await handle.trigger("keydown", { key: "ArrowDown" });
    const later = wrapper.find('[data-drag-index="2"] [data-drag-handle]');
    await later.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.emitted("move")).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it("never moves a step onto the source step", async () => {
    const wrapper = mountList();
    await wrapper
      .find('[data-drag-index="1"] [data-drag-handle]')
      .trigger("keydown", { key: "ArrowUp" });
    await wrapper
      .find('[data-drag-index="3"] [data-drag-handle]')
      .trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.emitted("move")).toBeUndefined();
    expect(
      wrapper.find('[data-drag-index="0"] [data-drag-handle]').exists(),
    ).toBe(false);
  });

  it("gives each row the list it works on and only its own errors", () => {
    const errors = new Map<number, RotationStepError[]>([
      [4, [{ step: 4, field: "count", message: "Must be at least 1" }]],
    ]);
    const rows = mountList(STEPS, errors).findAllComponents(RotationStepRow);
    expect(rows.map((row) => row.props("state").kind)).toEqual([
      "album",
      "album",
      "album",
      "track",
    ]);
    expect(rows[3]!.props("errors")).toHaveLength(1);
    expect(rows[1]!.props("errors")).toEqual([]);
    expect(rows[3]!.props("grouped")).toBe(true);
  });

  it("shows the group header after an expand", () => {
    expect(mountList().text()).toContain("Inside each album");
  });

  it("hides the add menu at the step limit", () => {
    const wrapper = mount(RotationStepList, {
      global: { plugins: [i18n] },
      props: {
        steps: STEPS,
        states: rowStates(STEPS),
        describe: DESCRIBE,
        counts: [],
        errors: new Map(),
        canAdd: false,
      },
    });
    expect(wrapper.findComponent(RotationAddStepMenu).exists()).toBe(false);
  });

  it("offers both expand targets from an artist list", () => {
    const steps: RotationStep[] = [
      { type: "source", media_type: "artist", from: "library" },
    ];
    const menu = mountList(steps).findComponent(RotationAddStepMenu);
    expect(menu.props("kind")).toBe("artist");
  });
  it("shows the right step in each row after a step before it is removed", async () => {
    const filter = (value: string): RotationStep => ({
      type: "filter",
      mode: "remove",
      match: "all",
      conditions: [{ field: "title", op: "contains", value }],
    });
    const steps: RotationStep[] = [
      { type: "source", media_type: "track", from: "library" },
      filter("Inhaltsangabe"),
      filter("Titelmusik"),
    ];
    const wrapper = mountList(steps);
    const remaining = [steps[0]!, steps[2]!];
    await wrapper.setProps({ steps: remaining, states: rowStates(remaining) });
    const row = wrapper.find('[data-drag-index="1"]');
    expect(row.text()).toContain("Titelmusik");
    expect(row.text()).not.toContain("Inhaltsangabe");
  });

  describe("invalid chips", () => {
    const INVALID = '[aria-invalid="true"]';

    function filterStep(): RotationStep {
      return {
        type: "filter",
        mode: "keep",
        match: "all",
        conditions: [
          { field: "title", op: "contains", value: "Folge" },
          { field: "album_type", op: "is", value: "album" },
        ],
      };
    }

    it("marks the condition that a moved step made invalid", async () => {
      const steps: RotationStep[] = [
        { type: "source", media_type: "album", from: "library" },
        filterStep(),
        { type: "expand", to: "track", scope: "library" },
      ];
      const wrapper = mountList(steps);
      expect(wrapper.find(INVALID).exists()).toBe(false);

      const moved = [steps[0]!, steps[2]!, steps[1]!];
      const message = "'album_type' is not available for tracks";
      await wrapper.setProps({
        steps: moved,
        states: rowStates(moved),
        errors: new Map([
          [3, [{ step: 3, field: "conditions[1].field", message }]],
        ]),
      });

      const row = wrapper.find('[data-drag-index="2"]');
      const invalid = row.findAll(INVALID);
      expect(invalid).toHaveLength(1);
      expect(invalid[0]!.text()).toContain("album_type");
      expect(invalid[0]!.classes()).toContain("border-destructive");
      expect(invalid[0]!.attributes("class")).not.toContain("primary");
      expect(invalid[0]!.attributes("title")).toContain(message);
      expect(row.text()).toContain(message);
    });

    it("marks only the sort key chip of the invalid key", () => {
      const steps: RotationStep[] = [
        { type: "source", media_type: "album", from: "library" },
        { type: "sort", keys: [{ field: "random" }, { field: "duration" }] },
      ];
      const message = "'duration' has no order";
      const wrapper = mountList(
        steps,
        new Map([[2, [{ step: 2, field: "keys[1].field", message }]]]),
      );
      const invalid = wrapper.findAll(INVALID);
      expect(invalid).toHaveLength(1);
      expect(invalid[0]!.attributes("aria-label")).toContain("duration");
      expect(invalid[0]!.classes()).toContain("border-destructive");
      expect(invalid[0]!.attributes("class")).not.toContain("primary");
      expect(invalid[0]!.attributes("title")).toBe(message);
    });

    it("marks an attribute chip by its attribute name", () => {
      const steps: RotationStep[] = [
        { type: "source", media_type: "artist", from: "library" },
        { type: "expand", to: "album", scope: "library" },
        filterStep(),
      ];
      const wrapper = mountList(
        steps,
        new Map([
          [2, [{ step: 2, field: "scope", message: "unknown scope" }]],
          [3, [{ step: 3, field: "mode", message: "unknown mode" }]],
        ]),
      );
      const scope = wrapper.find(`[data-drag-index="1"] ${INVALID}`);
      expect(scope.attributes("title")).toBe("unknown scope");
      const mode = wrapper.findAll(`[data-drag-index="2"] ${INVALID}`);
      expect(mode).toHaveLength(1);
      expect(mode[0]!.attributes("title")).toBe("unknown mode");
    });

    it("keeps errors without a chip under the step only", () => {
      const message = "the limit must be 1";
      const wrapper = mountList(
        STEPS,
        new Map([[4, [{ step: 4, field: null, message }]]]),
      );
      expect(wrapper.find(INVALID).exists()).toBe(false);
      expect(wrapper.text()).toContain(message);
    });

    it("marks an expand that no longer fits in red, with a sentence for any pair", () => {
      const message = "tracks cannot be expanded; remove this step";
      const moved: RotationStep[] = [
        { type: "source", media_type: "album", from: "library" },
        { type: "expand", to: "track", scope: "library" },
        { type: "expand", to: "track", scope: "library" },
      ];
      const wrapper = mountList(
        moved,
        new Map([[3, [{ step: 3, field: "to", message }]]]),
      );
      const phrase = wrapper.find(
        '[data-drag-index="2"] [data-testid="rotation-expand-phrase"]',
      );
      expect(phrase.attributes("aria-invalid")).toBe("true");
      expect(phrase.classes()).toContain("text-destructive");
      expect(phrase.attributes("title")).toBe(message);
      expect(phrase.text()).toBe("Play each item's tracks");
      expect(wrapper.text()).not.toContain("rotation.step.expand");
    });

    it("leaves valid chips without aria-invalid", () => {
      const wrapper = mountList(STEPS);
      expect(wrapper.findAll("[aria-invalid]")).toHaveLength(0);
    });
  });
});
