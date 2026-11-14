import RotationConditionChip from "@/components/rotation/RotationConditionChip.vue";
import type { RotationFieldInfo } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/plugins/i18n";

const { getItemByUri } = vi.hoisted(() => ({
  getItemByUri: vi.fn(async () => ({ name: "Die drei ???" })),
}));

vi.mock("@/plugins/api", () => ({ default: { getItemByUri } }));

enableAutoUnmount(afterEach);

const FIELDS = [
  {
    name: "title",
    type: "text",
    label: "Title",
    operators: ["contains", "is"],
    sortable: true,
  },
] as unknown as RotationFieldInfo[];

const LONG_TITLE =
  "Tag 01 - Unbekannter Herkunft (Teil 01) und Böser die Glocken nie klingen (Inhaltsangabe)";

function mountChip() {
  return mount(RotationConditionChip, {
    global: { plugins: [i18n] },
    props: {
      condition: { field: "title", op: "contains", value: LONG_TITLE },
      fields: FIELDS,
      removable: true,
    },
    attachTo: document.body,
  });
}

describe("RotationConditionChip", () => {
  it("truncates a long chip and keeps the full text in the title", () => {
    const trigger = mountChip().find("button");
    expect(trigger.classes()).toContain("max-w-full");
    expect(trigger.attributes("title")).toBe(`Title contains ${LONG_TITLE}`);
    const label = trigger.find("span.truncate");
    expect(label.exists()).toBe(true);
    expect(label.text()).toBe(`Title contains ${LONG_TITLE}`);
  });

  it("uses the theme colors for the chip", () => {
    const classes = mountChip().find("button").classes();
    expect(classes).toContain("bg-primary/15");
    expect(classes).toContain("text-foreground");
    expect(classes).toContain("dark:text-primary");
    expect(classes.some((c) => c.includes("blue-500"))).toBe(false);
  });

  it("keeps the open popover inside a narrow screen", async () => {
    const wrapper = mountChip();
    await wrapper.find("button").trigger("click");
    await flushPromises();
    const content = document.body.querySelector(
      '[data-slot="popover-content"]',
    );
    expect(content).not.toBeNull();
    expect(content!.className).toContain("max-w-[min(420px,calc(100vw-2rem))]");
  });

  it("shows the labels of the picked audio qualities", () => {
    const fields = [
      {
        name: "audio_quality",
        type: "ref",
        label: "Audio quality",
        operators: ["is", "is_not", "one_of"],
        sortable: false,
      },
    ] as unknown as RotationFieldInfo[];
    const wrapper = mount(RotationConditionChip, {
      global: { plugins: [i18n] },
      props: {
        condition: {
          field: "audio_quality",
          op: "one_of",
          value: ["lossless", "hi_res"],
        },
        fields,
      },
    });
    const text = wrapper.find("button").attributes("title");
    expect(text).toBe("Audio quality is Lossless or Hi-res");
  });

  it.each([
    ["between", [1, 5], "Track number is between 1 and 5"],
    ["in_last_days", 1, "Track number is in the last 1 day"],
    ["in_last_days", 30, "Track number is in the last 30 days"],
    ["less_than", 3, "Track number is less than 3"],
  ])("reads %s with %j as one sentence", (op, value, sentence) => {
    const fields = [
      {
        name: "track_number",
        type: "number",
        label: "Track number",
        operators: ["between", "in_last_days", "less_than"],
        sortable: true,
      },
    ] as unknown as RotationFieldInfo[];
    const wrapper = mount(RotationConditionChip, {
      global: { plugins: [i18n] },
      props: { condition: { field: "track_number", op, value }, fields },
    });
    expect(wrapper.find("button").attributes("title")).toBe(sentence);
  });
});

describe("RotationConditionChip on a date field", () => {
  const DATE_FIELDS = [
    {
      name: "date_added",
      type: "date",
      label: "Date added",
      operators: ["less_than", "more_than"],
      sortable: true,
    },
  ] as unknown as RotationFieldInfo[];

  function mountDate(op: string) {
    return mount(RotationConditionChip, {
      global: { plugins: [i18n] },
      props: {
        condition: { field: "date_added", op, value: "2026-01-01" },
        fields: DATE_FIELDS,
        removable: true,
      },
    });
  }

  it("says before and after instead of less and more", () => {
    expect(mountDate("less_than").find("button").text()).toBe(
      "Date added is before 2026-01-01",
    );
    expect(mountDate("more_than").find("button").text()).toBe(
      "Date added is after 2026-01-01",
    );
  });
});

describe("RotationConditionChip on a reference field", () => {
  const ARTIST_FIELDS = [
    {
      name: "artist",
      type: "ref",
      label: "Artist",
      operators: ["is", "is_not", "one_of", "contains", "starts_with"],
      sortable: false,
    },
  ] as unknown as RotationFieldInfo[];

  function mountArtist(op: string, value: unknown) {
    return mount(RotationConditionChip, {
      global: { plugins: [i18n] },
      props: {
        condition: { field: "artist", op, value },
        fields: ARTIST_FIELDS,
      },
    });
  }

  it.each([
    ["contains", "AC/DC", "Artist contains AC/DC"],
    [
      "starts_with",
      "library://artist/",
      "Artist starts with library://artist/",
    ],
  ])(
    "shows a name matched with %s as typed, without looking it up",
    async (op, value, sentence) => {
      getItemByUri.mockClear();
      const wrapper = mountArtist(op, value);
      await flushPromises();
      expect(wrapper.find("button").attributes("title")).toBe(sentence);
      expect(getItemByUri).not.toHaveBeenCalled();
    },
  );

  it("looks up the item of a picked reference", async () => {
    getItemByUri.mockClear();
    const wrapper = mountArtist("is", "library://artist/7");
    await flushPromises();
    expect(getItemByUri).toHaveBeenCalledWith("library://artist/7");
    expect(wrapper.find("button").attributes("title")).toBe(
      "Artist is Die drei ???",
    );
  });
});
