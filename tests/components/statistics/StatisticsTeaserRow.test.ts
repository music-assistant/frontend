import StatisticsTeaserRow from "@/components/statistics/StatisticsTeaserRow.vue";
import type {
  StatisticsData,
  StatisticsSection,
} from "@/composables/useStatistics";
import { i18n } from "@/plugins/i18n";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref, shallowRef } from "vue";

const { statistics, useStatistics } = vi.hoisted(() => ({
  statistics: {} as {
    data: { value: Partial<StatisticsData> };
    failed: { value: ReadonlySet<StatisticsSection> };
    loading: { value: boolean };
  },
  useStatistics: vi.fn(),
}));

vi.mock("@/composables/useStatistics", () => ({ useStatistics }));

enableAutoUnmount(afterEach);

const originalLocale = i18n.global.locale.value;

beforeEach(() => {
  i18n.global.locale.value = "en_GB";
  statistics.data = shallowRef({ playsOverTime: [] });
  statistics.failed = shallowRef(new Set());
  statistics.loading = ref(false);
  useStatistics.mockReset();
  useStatistics.mockReturnValue(statistics);
});

afterEach(() => {
  i18n.global.locale.value = originalLocale;
});

function mountTeaser(active = true) {
  return mount(StatisticsTeaserRow, {
    props: { active },
    global: {
      stubs: {
        RouterLink: {
          props: ["to"],
          template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
        },
        StatisticsPlaysChart: { template: '<div data-testid="chart" />' },
      },
    },
  });
}

describe("StatisticsTeaserRow", () => {
  it("only requests plays over time, for as long as it is active", () => {
    mountTeaser(false);

    const options = useStatistics.mock.calls[0][0];
    expect(options.sections).toEqual(["playsOverTime"]);
    expect(options.active.value).toBe(false);
    expect(options.period.value).toBe("week");
  });

  it("links to the statistics page for the chosen period", () => {
    const wrapper = mountTeaser();

    const link = wrapper.find("a");
    expect(link.text()).toContain("All statistics");
    expect(JSON.parse(link.attributes("data-to")!)).toEqual({
      name: "statistics",
      query: { period: "week" },
    });
  });

  it("shows placeholders while loading", () => {
    statistics.loading.value = true;
    const wrapper = mountTeaser();

    expect(wrapper.find('[data-slot="skeleton"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="chart"]').exists()).toBe(false);
  });

  it("shows an inline error when the plays could not be loaded", () => {
    statistics.failed.value = new Set(["playsOverTime"]);
    const wrapper = mountTeaser();

    expect(wrapper.find('[role="alert"]').text()).toBe(
      "These statistics could not be loaded.",
    );
  });

  it("says so when nothing was played", () => {
    statistics.data.value = {
      playsOverTime: [{ timestamp: "2026-10-14", value: 0 }],
    };
    const wrapper = mountTeaser();

    expect(wrapper.text()).toContain("0 plays");
    expect(wrapper.text()).toContain("No listening history yet");
    expect(wrapper.find('[data-testid="chart"]').exists()).toBe(false);
  });

  it("summarises the period's plays", () => {
    statistics.data.value = {
      playsOverTime: [
        { timestamp: "2026-10-12", value: 1 },
        { timestamp: "2026-10-13", value: 0 },
        { timestamp: "2026-10-14", value: 5 },
      ],
    };
    const wrapper = mountTeaser();

    expect(wrapper.text()).toContain("6 plays");
    expect(wrapper.text()).toContain("2 a day on average.");
    expect(wrapper.text()).toContain(
      "Wednesday 14 October was your busiest day.",
    );
    expect(wrapper.find('[data-testid="chart"]').exists()).toBe(true);
  });

  it("uses the singular for a single play", () => {
    statistics.data.value = {
      playsOverTime: [{ timestamp: "2026-10-14", value: 1 }],
    };

    expect(mountTeaser().text()).toContain("1 play");
    expect(mountTeaser().text()).not.toContain("1 plays");
  });
});
