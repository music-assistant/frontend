import StatisticsPeriodSelect from "@/components/statistics/StatisticsPeriodSelect.vue";
import StatisticsLibraryInfo from "@/components/statistics/StatisticsLibraryInfo.vue";
import StatisticsUserSelect from "@/components/statistics/StatisticsUserSelect.vue";
import { Tabs } from "@/components/ui/tabs";
import type {
  StatisticsData,
  StatisticsSection,
} from "@/composables/useStatistics";
import {
  MediaType,
  type StatisticsTopItemResult,
  type StatisticsUsers,
  type User,
} from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import StatisticsView from "@/views/StatisticsView.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref, shallowRef } from "vue";

const {
  statistics,
  topItems,
  statisticsUsers,
  useStatistics,
  routerReplace,
  routerPush,
  hasScope,
  toastWarning,
} = vi.hoisted(() => ({
  statistics: {} as {
    data: { value: StatisticsData };
    failed: { value: ReadonlySet<StatisticsSection> };
    loading: { value: boolean };
  },
  topItems: {} as Record<string, { value: unknown }>,
  statisticsUsers: {} as {
    users: { value: User[] };
    loaded: { value: boolean };
  },
  useStatistics: vi.fn(),
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  hasScope: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("vue-sonner", () => ({ toast: { warning: toastWarning } }));

vi.mock("@/composables/useStatistics", () => ({
  useStatistics,
  useStatisticsTopItems: () => topItems,
  useStatisticsUsers: () => statisticsUsers,
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
  useRoute: () => ({ query: { period: "month" } }),
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
  topAlbums: [],
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
  statisticsUsers.users = shallowRef([
    { user_id: "alice", username: "alice" },
    { user_id: "bob", username: "bob" },
  ] as User[]);
  statisticsUsers.loaded = ref(true);
  toastWarning.mockReset();
  useStatistics.mockReset();
  useStatistics.mockReturnValue(statistics);
  routerReplace.mockReset();
  routerPush.mockReset();
  hasScope.mockReset();
  hasScope.mockReturnValue(false);
});

afterEach(() => {
  i18n.global.locale.value = originalLocale;
});

function mountView(users: StatisticsUsers = {}) {
  return mount(StatisticsView, {
    props: { period: "month", users },
    global: {
      stubs: {
        // charts draw with Unovis, which needs a real layout engine
        ChartContainer: { template: '<div data-testid="chart" />' },
        StatisticsPlaysChart: { template: '<div data-testid="chart" />' },
        // tested on its own
        StatisticsUserSelect: true,
      },
    },
  });
}

describe("StatisticsView", () => {
  it.each([
    { loading: false, failed: new Set<StatisticsSection>() },
    {
      loading: false,
      failed: new Set<StatisticsSection>([
        "genreDistribution",
        "decadeDistribution",
        "listeningTime",
      ]),
    },
    { loading: true, failed: new Set<StatisticsSection>() },
  ])(
    "labels only library-dependent cards, including empty, failed and loading states ($loading)",
    async ({ loading, failed }) => {
      statistics.loading.value = loading;
      statistics.failed.value = failed;
      const wrapper = mountView();

      const explanations = () =>
        wrapper.findAllComponents(StatisticsLibraryInfo).map((badge) => ({
          statistic: badge.props("statistic"),
          explanation: badge.props("explanation"),
        }));
      const baseExplanations = [
        {
          statistic: "Top genre",
          explanation:
            "Includes plays linked to library tracks with genre information. Other plays may be missing.",
        },
        {
          statistic: "Release years",
          explanation:
            "Includes plays linked to library tracks with an album release year. Other plays may be missing.",
        },
        {
          statistic: "Top artists by listening time",
          explanation:
            "Calculated from completed plays linked to library tracks with a known duration. Other plays may be missing.",
        },
      ];
      expect(explanations()).toEqual(baseExplanations);

      const tabs = wrapper.getComponent(Tabs);
      tabs.vm.$emit("update:modelValue", MediaType.ALBUM);
      await flushPromises();
      expect(explanations()).toEqual([
        ...baseExplanations,
        {
          statistic: "Top albums",
          explanation:
            "Includes plays linked to library tracks with album information. Other plays may be missing.",
        },
      ]);

      for (const mediaType of [
        MediaType.ARTIST,
        MediaType.PLAYLIST,
        MediaType.TRACK,
      ]) {
        tabs.vm.$emit("update:modelValue", mediaType);
        await flushPromises();
        expect(explanations()).toEqual(baseExplanations);
      }
    },
  );

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

  it.each([
    { allowed: true, subtitle: "What was played on Music Assistant" },
    { allowed: false, subtitle: "What you played on Music Assistant" },
  ])(
    "shows the users of the route only with the impersonate scope ($allowed)",
    ({ allowed, subtitle }) => {
      hasScope.mockReturnValue(allowed);
      const wrapper = mountView({ users: ["alice"] });

      expect(wrapper.findComponent(StatisticsUserSelect).exists()).toBe(
        allowed,
      );
      expect(useStatistics.mock.calls[0][0].users.value).toEqual(
        allowed ? { users: ["alice"] } : {},
      );
      expect(wrapper.text()).toContain(subtitle);
    },
  );

  it.each([
    {
      users: { users: ["alice", "bob"] },
      query: { period: "month", users: "alice,bob" },
    },
    {
      users: { all_users: true },
      query: { period: "month", all_users: "true" },
    },
    { users: {}, query: { period: "month" } },
  ])("keeps the chosen users $users in the url", async ({ users, query }) => {
    hasScope.mockReturnValue(true);
    const wrapper = mountView({ users: ["alice"] });

    wrapper
      .findComponent(StatisticsUserSelect)
      .vm.$emit("update:modelValue", users);
    await flushPromises();

    expect(routerReplace).toHaveBeenCalledWith({ query });
  });

  it("holds the statistics until the users of the link are known", async () => {
    hasScope.mockReturnValue(true);
    statisticsUsers.loaded.value = false;
    mountView({ users: ["alice", "gone", "Bob"] });
    const active = useStatistics.mock.calls[0][0].active;
    expect(active.value).toBe(false);

    statisticsUsers.loaded.value = true;
    await flushPromises();

    // the deleted user is dropped and the username replaced by the id
    expect(toastWarning).toHaveBeenCalledExactlyOnceWith(
      "Some selected users no longer exist and were removed.",
    );
    expect(routerReplace).toHaveBeenCalledWith({
      query: { period: "month", users: "alice,bob" },
    });
    expect(active.value).toBe(false);
  });

  it("goes back to Discover when opened directly", async () => {
    const wrapper = mountView();

    await wrapper.find('button[aria-label="Back"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({ name: "discover" });
  });
});
