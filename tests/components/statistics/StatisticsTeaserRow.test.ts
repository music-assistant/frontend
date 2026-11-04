import StatisticsTeaserRow from "@/components/statistics/StatisticsTeaserRow.vue";
import type {
  StatisticsData,
  StatisticsSection,
} from "@/composables/useStatistics";
import type { User } from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref, shallowRef } from "vue";

const { setUserPreference, statistics, useStatistics } = vi.hoisted(() => ({
  setUserPreference: vi.fn(),
  statistics: {} as {
    data: { value: Partial<StatisticsData> };
    failed: { value: ReadonlySet<StatisticsSection> };
    loading: { value: boolean };
  },
  useStatistics: vi.fn(),
}));

vi.mock("@/composables/useStatistics", () => ({ useStatistics }));
vi.mock("@/composables/userPreferences", () => ({ setUserPreference }));

const PERIOD_PREFERENCE_KEY = "discover.statisticsPeriod";
const originalUser = store.currentUser;

function signInWith(preferences: Record<string, unknown>) {
  store.currentUser = { user_id: "user-1", preferences } as unknown as User;
}

enableAutoUnmount(afterEach);

const originalLocale = i18n.global.locale.value;

beforeEach(() => {
  i18n.global.locale.value = "en_GB";
  statistics.data = shallowRef({ playsOverTime: [] });
  statistics.failed = shallowRef(new Set());
  statistics.loading = ref(false);
  useStatistics.mockReset();
  useStatistics.mockReturnValue(statistics);
  setUserPreference.mockReset();
  setUserPreference.mockResolvedValue(true);
  signInWith({});
});

afterEach(() => {
  i18n.global.locale.value = originalLocale;
  store.currentUser = originalUser;
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
      // the 8 calendar days a rolling week touches
      playsOverTime: [
        { timestamp: "2026-10-11", value: 0 },
        { timestamp: "2026-10-12", value: 1 },
        { timestamp: "2026-10-13", value: 0 },
        { timestamp: "2026-10-14", value: 5 },
        { timestamp: "2026-10-15", value: 2 },
        { timestamp: "2026-10-16", value: 3 },
        { timestamp: "2026-10-17", value: 2 },
        { timestamp: "2026-10-18", value: 1 },
      ],
    };
    const wrapper = mountTeaser();

    expect(wrapper.text()).toContain("14 plays");
    // per day of the 7-day period, not per calendar day shown
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

  it("opens with the period the user saved", () => {
    signInWith({ [PERIOD_PREFERENCE_KEY]: "month" });
    mountTeaser();

    expect(useStatistics.mock.calls[0][0].period.value).toBe("month");
  });

  it.each([undefined, "fortnight", 7])(
    "falls back to the default period for a saved %s",
    (saved) => {
      signInWith({ [PERIOD_PREFERENCE_KEY]: saved });
      mountTeaser();

      expect(useStatistics.mock.calls[0][0].period.value).toBe("week");
    },
  );

  it("saves a newly chosen period, and nothing on mount alone", async () => {
    mountTeaser();
    await flushPromises();
    expect(setUserPreference).not.toHaveBeenCalled();

    useStatistics.mock.calls[0][0].period.value = "year";
    await flushPromises();

    expect(setUserPreference).toHaveBeenCalledExactlyOnceWith(
      PERIOD_PREFERENCE_KEY,
      "year",
    );
  });
});
