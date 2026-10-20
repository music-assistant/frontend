import BarChartCard from "@/components/statistics/BarChartCard.vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { translate } = vi.hoisted(() => ({
  translate: vi.fn((key: string) => key),
}));

vi.mock("vue-chartjs", () => ({
  Bar: {
    name: "Bar",
    props: ["options"],
    template: "<div />",
  },
}));
vi.mock("vuetify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vuetify")>()),
  useTheme: () => ({
    current: { value: { colors: { fg: "#000" }, dark: false } },
  }),
}));
vi.mock("@/plugins/i18n", () => ({ $t: translate }));
vi.mock("@/components/statistics/BaseChartCard.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      props: {
        title: { type: String, required: true },
        loading: Boolean,
        isEmpty: Boolean,
        emptyMessage: { type: String, required: true },
        accessibleSummary: { type: String, required: true },
      },
      setup(_props, { slots }) {
        return () => h("div", slots.default?.());
      },
    }),
  };
});

afterEach(() => vi.clearAllMocks());

describe("BarChartCard duration tooltip", () => {
  it("normalizes rounded fractional minutes into hours and remainder", () => {
    const wrapper = mount(BarChartCard, {
      props: {
        title: "Listening time",
        data: [{ name: "Artist", minutes: 59.6 }],
      },
    });
    const options = wrapper.findComponent({ name: "Bar" }).props("options");
    const label = options.plugins.tooltip.callbacks.label as (context: {
      parsed: { x: number };
    }) => string;

    expect(label({ parsed: { x: 59.6 } })).toBe("duration_hours_minutes");
    expect(translate).toHaveBeenCalledWith("duration_hours_minutes", {
      hours: 1,
      minutes: 0,
    });
  });
});
