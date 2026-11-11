import StatisticsMostPlayed from "@/components/statistics/StatisticsMostPlayed.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import {
  MediaType,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";

const { state } = vi.hoisted(() => ({
  state: {
    connected: { value: true },
    playActionInProgress: { value: false },
  },
}));
vi.mock("@/composables/useMediaPlayState", () => ({
  useMediaPlayState: () => state,
}));
vi.mock("@/components/discover/EditorialMediaCard.vue", () => ({
  default: {
    props: ["item", "disabled", "disablePlayButton"],
    template: "<div />",
  },
}));

describe("StatisticsMostPlayed playback", () => {
  it("passes the same connection and pending-play state as the teaser", async () => {
    state.connected = ref(false);
    state.playActionInProgress = ref(true);
    const entry: StatisticsTopItemResult = {
      play_count: 2,
      item: {
        name: "Track",
        item_id: "1",
        provider: "library",
        uri: "library://track/1",
        media_type: MediaType.TRACK,
        version: "",
        external_ids: [],
        is_playable: true,
        available: true,
      },
    };
    const wrapper = mount(StatisticsMostPlayed, { props: { tracks: [entry] } });
    const card = wrapper.findComponent(EditorialMediaCard);
    expect(card.props("disabled")).toBe(true);
    expect(card.props("disablePlayButton")).toBe(true);
    state.connected.value = true;
    state.playActionInProgress.value = false;
    await wrapper.vm.$nextTick();
    expect(card.props("disabled")).toBe(false);
    expect(card.props("disablePlayButton")).toBe(false);
    wrapper.unmount();
  });
});
