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
    props: ["options", "ariaLabel", "role"],
    template:
      '<canvas class="chart-hit" :role="role" :aria-label="ariaLabel" @click="options.onClick?.(undefined, [{ index: 0 }])"></canvas>',
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

function renderChart(navigateTo: "artist" | "genre" | null = "artist") {
  const mediaType = navigateTo === "genre" ? MediaType.GENRE : MediaType.ARTIST;
  return mount(PieChartCard, {
    props: {
      title: "Artists",
      navigateTo,
      data: [
        {
          item: {
            item_id: `${mediaType}-1`,
            provider: "library",
            media_type: mediaType,
            name: "Artist",
            uri: `${mediaType}://library/${mediaType}-1`,
            available: true,
          },
          play_count: 3,
        } as StatisticsTopItemResult,
      ],
    },
  });
}

describe("PieChartCard navigation", () => {
  it("labels the chart canvas with its accessible data summary", () => {
    const wrapper = renderChart();
    const accessibleSummary = wrapper.get("canvas").attributes("aria-label");

    expect(wrapper.get("canvas").attributes("role")).toBe("img");
    expect(accessibleSummary).toContain("Artists");
    expect(accessibleSummary).toContain("Artist: 3 plays");
    expect(wrapper.findAll(`[aria-label="${accessibleSummary}"]`)).toHaveLength(
      1,
    );
  });

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

  it("routes genre chart segments to the genre detail page", async () => {
    const wrapper = renderChart("genre");
    await wrapper.find(".chart-hit").trigger("click");

    expect(push).toHaveBeenCalledExactlyOnceWith({
      name: "genre",
      params: { provider: "library", itemId: `${MediaType.GENRE}-1` },
    });
  });
});
