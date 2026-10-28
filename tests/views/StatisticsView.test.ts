import StatisticsPeriodSelect from "@/components/statistics/StatisticsPeriodSelect.vue";
import type {
  StatisticsData,
  StatisticsSection,
} from "@/composables/useStatistics";
import {
  MediaType,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import StatisticsView from "@/views/StatisticsView.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref, shallowRef } from "vue";

const { statistics, topItems, useStatistics, routerReplace, routerPush } =
  vi.hoisted(() => ({
    statistics: {} as {
      data: { value: StatisticsData };
      failed: { value: ReadonlySet<StatisticsSection> };
      loading: { value: boolean };
    },
    topItems: {} as Record<string, { value: unknown }>,
    useStatistics: vi.fn(),
    routerReplace: vi.fn(),
    routerPush: vi.fn(),
  }));

vi.mock("@/composables/useStatistics", () => ({
  useStatistics,
  useStatisticsTopItems: () => topItems,
}));
vi.mock("@/composables/useEscapeBack", () => ({ useEscapeBack: vi.fn() }));
// the artwork components pull in Vuetify, which is not what is tested here
vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { name: "MediaItemThumb", template: "<span />" },
}));
vi.mock("@/components/discover/EditorialMediaCard.vue", () => ({
  default: {
    name: "EditorialMediaCard",
    props: ["item"],
    template:
      '<div data-testid="cover">{{ item.name }}<slot name="subtitle" /></div>',
  },
}));
vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: vi.fn(),
  handlePlayBtnClick: vi.fn(),
  handleMenuBtnClick: vi.fn(),
}));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({
    replace: routerReplace,
    push: routerPush,
    options: { history: { state: { back: null } } },
  }),
}));

enableAutoUnmount(afterEach);

const originalLocale = i18n.global.locale.value;

const track = (name: string, plays: number): StatisticsTopItemResult => ({
  item: {
    item_id: name,
    provider: "library",
    media_type: MediaType.TRACK,
    name,
    uri: `library://track/${name}`,
    available: true,
  } as StatisticsTopItemResult["item"],
  play_count: plays,
});

const emptyData = (): StatisticsData => ({
  playsOverTime: [],
  topTracks: [],
  topArtists: [],
  listeningActivity: [],
  listeningTime: [],
  genreDistribution: [],
  decadeDistribution: [],
});

beforeEach(() => {
  i18n.global.locale.value = "en_GB";
  statistics.data = shallowRef(emptyData());
  statistics.failed = shallowRef(new Set());
  statistics.loading = ref(false);
  topItems.items = shallowRef([]);
  topItems.error = ref(false);
  topItems.loading = ref(false);
  useStatistics.mockReset();
  useStatistics.mockReturnValue(statistics);
  routerReplace.mockReset();
  routerPush.mockReset();
});

afterEach(() => {
  i18n.global.locale.value = originalLocale;
});

function mountView() {
  return mount(StatisticsView, {
    props: { period: "month" },
    global: {
      stubs: {
        // charts draw with Unovis, which needs a real layout engine
        ChartContainer: { template: '<div data-testid="chart" />' },
        StatisticsPlaysChart: { template: '<div data-testid="chart" />' },
      },
    },
  });
}

describe("StatisticsView", () => {
  it("loads every section for the period from the route", () => {
    mountView();

    const options = useStatistics.mock.calls[0][0];
    expect(options.period.value).toBe("month");
    expect(options.sections).toHaveLength(7);
  });

  it("shows the empty state of each section when nothing was played", () => {
    const wrapper = mountView();

    expect(wrapper.text()).toContain("0 plays");
    expect(wrapper.text()).toContain("Nothing played in this period");
    expect(wrapper.find("table tbody tr").exists()).toBe(false);
  });

  it("shows an inline error only in the sections that failed", () => {
    statistics.failed.value = new Set(["genreDistribution", "topTracks"]);
    const wrapper = mountView();

    // the genre card, the cover row and the top tracks table
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(3);
  });

  it("shows the period's statistics", () => {
    statistics.data.value = {
      ...emptyData(),
      playsOverTime: [
        { timestamp: "2026-10-13", value: 2 },
        { timestamp: "2026-10-14", value: 8 },
      ],
      topTracks: [track("Hello", 8), track("Sun & Moon", 2)],
      genreDistribution: [
        { name: "Techno", value: 3 },
        { name: "House", value: 1 },
      ],
      decadeDistribution: [{ name: "2020s", value: 4 }],
      listeningTime: [{ name: "Above & Beyond", minutes: 42.4 }],
    };
    const wrapper = mountView();

    expect(wrapper.text()).toContain("10 plays");
    expect(wrapper.text()).toContain("Mostly the 2020s");
    expect(wrapper.text()).toContain("42 min");
    expect(
      wrapper.findAll('[data-testid="cover"]').map((c) => c.text()),
    ).toEqual(["Hello8 plays", "Sun & Moon2 plays"]);
    const rows = wrapper.findAll("table tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[1].text()).toContain("Sun & Moon");
    expect(rows[1].find('[role="img"]').attributes("aria-label")).toBe(
      "25% of the plays of number one",
    );
  });

  it("keeps a new period in the url", async () => {
    const wrapper = mountView();

    wrapper
      .findComponent(StatisticsPeriodSelect)
      .vm.$emit("update:modelValue", "year");
    await flushPromises();

    expect(routerReplace).toHaveBeenCalledWith({ query: { period: "year" } });
  });

  it("goes back to Discover when opened directly", async () => {
    const wrapper = mountView();

    await wrapper.find('button[aria-label="Back"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({ name: "discover" });
  });
});
