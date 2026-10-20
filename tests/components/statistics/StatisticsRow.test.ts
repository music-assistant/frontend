import ChartItem from "@/components/discover/ChartItem.vue";
import BarChartCard from "@/components/statistics/BarChartCard.vue";
import DecadeBarChartCard from "@/components/statistics/DecadeBarChartCard.vue";
import LineChartCard from "@/components/statistics/LineChartCard.vue";
import ListeningClockCard from "@/components/statistics/ListeningClockCard.vue";
import ListeningHeatmapCard from "@/components/statistics/ListeningHeatmapCard.vue";
import PieChartCard from "@/components/statistics/PieChartCard.vue";
import StatisticsRow from "@/components/statistics/StatisticsRow.vue";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import {
  MediaType,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

enableAutoUnmount(afterEach);

function renderRow(
  overrides: Partial<InstanceType<typeof StatisticsRow>["$props"]> = {},
) {
  return shallowMount(StatisticsRow, {
    props: {
      activeTab: MediaType.TRACK,
      period: "week",
      items: [],
      loading: false,
      error: false,
      chartsLoading: false,
      charts: {
        artistDistribution: [],
        playsOverTime: [],
        listeningActivity: [],
        listeningTime: [],
        decadeDistribution: [],
      },
      ...overrides,
    },
    slots: { "edit-controls": '<button class="edit-control">Edit</button>' },
  });
}

describe("StatisticsRow", () => {
  it("preserves the section root and parent-provided edit controls", () => {
    const wrapper = renderRow({ dimmed: true });

    expect(wrapper.element.tagName).toBe("SECTION");
    expect(wrapper.classes()).toContain("ed-section");
    expect(wrapper.classes()).toContain("ed-dimmed");
    expect(wrapper.find(".edit-control").exists()).toBe(true);
  });

  it("shows loading, error and empty states independently", async () => {
    const wrapper = renderRow({ loading: true });
    expect(wrapper.findComponent(Spinner).exists()).toBe(true);

    await wrapper.setProps({ loading: false, error: true });
    expect(wrapper.text()).toContain($t("statistics_load_failed"));

    await wrapper.setProps({ error: false });
    expect(wrapper.text()).toContain($t("no_statistics_data"));
  });

  it("passes ranking positions and counts to the existing cards", () => {
    const item = {
      item: {
        item_id: "track-1",
        provider: "library",
        media_type: MediaType.TRACK,
        uri: "track://library/track-1",
        name: "Track",
        available: true,
      },
      play_count: 7,
    } as StatisticsTopItemResult;
    const wrapper = renderRow({ items: [item] });

    expect(wrapper.findComponent(ChartItem).props()).toMatchObject({
      item: item.item,
      position: 1,
      playCount: 7,
    });
  });

  it("keeps all six charts and their period and loading inputs", () => {
    const wrapper = renderRow({ period: "today", chartsLoading: true });
    for (const chart of [
      PieChartCard,
      LineChartCard,
      BarChartCard,
      ListeningClockCard,
      ListeningHeatmapCard,
      DecadeBarChartCard,
    ]) {
      expect(wrapper.findComponent(chart).props("loading")).toBe(true);
    }
    expect(wrapper.findComponent(LineChartCard).props("period")).toBe("today");
  });

  it("emits tab and period changes without owning requests", async () => {
    const wrapper = renderRow();
    wrapper.findComponent(Tabs).vm.$emit("update:modelValue", MediaType.ALBUM);
    await wrapper.find("select").setValue("month");

    expect(wrapper.emitted("update:activeTab")).toEqual([[MediaType.ALBUM]]);
    expect(wrapper.emitted("update:period")).toEqual([["month"]]);
  });
});
