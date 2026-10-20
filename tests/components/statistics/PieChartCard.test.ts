import PieChartCard from "@/components/statistics/PieChartCard.vue";
import {
  MediaType,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("vue-chartjs", () => ({
  Doughnut: {
    props: ["options"],
    template:
      '<button class="chart-hit" @click="options.onClick?.(undefined, [{ index: 0 }])">Chart</button>',
  },
}));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push }),
}));
vi.mock("vuetify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vuetify")>()),
  useTheme: () => ({ current: { value: { dark: false } } }),
}));

enableAutoUnmount(afterEach);
afterEach(() => vi.clearAllMocks());

function renderChart(navigateTo: "artist" | null = "artist") {
  return mount(PieChartCard, {
    props: {
      title: "Artists",
      navigateTo,
      data: [
        {
          item: {
            item_id: "artist-1",
            provider: "library",
            media_type: MediaType.ARTIST,
            name: "Artist",
            uri: "artist://library/artist-1",
            available: true,
          },
          play_count: 3,
        } as StatisticsTopItemResult,
      ],
    },
  });
}

describe("PieChartCard navigation", () => {
  it("navigates chart segments and legend entries to the same artist", async () => {
    const wrapper = renderChart();
    await wrapper.find(".chart-hit").trigger("click");
    await wrapper.find("button[aria-label]").trigger("click");

    expect(push.mock.calls).toEqual([
      [{ name: "artist", params: { provider: "library", itemId: "artist-1" } }],
      [{ name: "artist", params: { provider: "library", itemId: "artist-1" } }],
    ]);
  });

  it("keeps navigation disabled when no target is configured", async () => {
    const wrapper = renderChart(null);
    await wrapper.find(".chart-hit").trigger("click");
    expect(
      wrapper.find("button[aria-label]").attributes("disabled"),
    ).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });
});
