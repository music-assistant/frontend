import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import DetailHeroListeningStats from "@/components/details/DetailHeroListeningStats.vue";
import { track } from "../../fixtures/track";

const { useHistory } = vi.hoisted(() => ({ useHistory: vi.fn() }));
vi.mock("@/composables/useItemListeningHistory", () => ({
  useItemListeningHistory: useHistory,
}));
vi.mock("@/composables/useCanonicalLocale", () => ({
  useCanonicalLocale: () => ref("en-GB"),
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/components/statistics/StatisticsPlaysChart.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/ListeningHistoryDialog.vue", () => ({
  default: { template: "<div data-history-dialog />" },
}));

function historyState() {
  return {
    enabled: ref(true),
    open: ref(false),
    period: ref("month"),
    count: ref<number | null>(0),
    trend: ref([]),
    entries: ref([]),
    series: ref([]),
    failed: ref(false),
    historyFailed: ref(false),
    hasMore: ref(false),
    loading: ref(false),
    historyLoading: ref(false),
    loadingMore: ref(false),
    loadMore: vi.fn(),
    refresh: vi.fn(),
    refreshHistory: vi.fn(),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
});

describe("detail hero listening statistics", () => {
  it("opens the shared history dialog, including for an item with no recorded plays", async () => {
    const state = historyState();
    useHistory.mockReturnValue(state);
    const wrapper = mount(DetailHeroListeningStats, {
      props: { item: track() },
    });
    expect(wrapper.find("[data-history-dialog]").exists()).toBe(false);
    await wrapper.get("button[aria-haspopup=dialog]").trigger("click");
    expect(state.open.value).toBe(true);
    expect(wrapper.find("[data-history-dialog]").exists()).toBe(true);
    wrapper.unmount();
  });
  it("shows a retry instead of a false count after an API failure", async () => {
    const state = historyState();
    state.failed.value = true;
    state.count.value = null;
    useHistory.mockReturnValue(state);
    const wrapper = mount(DetailHeroListeningStats, {
      props: { item: track() },
    });
    expect(wrapper.find("[aria-haspopup=dialog]").exists()).toBe(false);
    expect(wrapper.get("[role=alert]").text()).toContain(
      "listening_history.load_failed",
    );
    await wrapper.get("button").trigger("click");
    expect(state.refresh).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it("renders no statistics block when that media type is disabled", () => {
    const state = historyState();
    state.enabled.value = false;
    useHistory.mockReturnValue(state);
    const wrapper = mount(DetailHeroListeningStats, {
      props: { item: track() },
    });
    expect(wrapper.find(".detail-hero-listening").exists()).toBe(false);
    wrapper.unmount();
  });
});
