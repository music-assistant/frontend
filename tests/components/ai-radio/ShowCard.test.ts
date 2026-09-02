import ShowCard from "@/components/ai-radio/ShowCard.vue";
import { showUri, useShows } from "@/composables/ai-radio/useShows";
import type { MusicAssistantApi } from "@/plugins/api";
import type { AIRadioStation } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { playMedia, sendCommand } = vi.hoisted(() => ({
  playMedia: vi.fn(async () => undefined),
  sendCommand: vi.fn(async () => ({})),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    players: {},
    queues: {},
    providers: {},
    sendCommand,
    getLibraryPlaylists: vi.fn<MusicAssistantApi["getLibraryPlaylists"]>(
      async () => [],
    ),
    playMedia,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: { activePlayerId: "kitchen" },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const show = {
  id: "party_host_pirates",
  name: "Party host — Pirates",
  source_playlist_id: "42",
  source_playlist_provider: "library",
} as AIRadioStation;

const onAir = (queueId: string, stationId = show.id) => ({
  [queueId]: { host_id: "host-1", station_id: stationId },
});

const renderCard = (overrides: Partial<AIRadioStation> = {}) =>
  mount(ShowCard, {
    props: { show: { ...show, ...overrides } },
    shallow: true,
  });

afterEach(() => {
  vi.clearAllMocks();
  useShows().djStatus.value = {};
});

describe("ShowCard on-air state", () => {
  it("offers play while no queue's dj runs the show", () => {
    const wrapper = renderCard();

    expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Stop"]').exists()).toBe(false);
    expect(wrapper.find(".show-card__onair").exists()).toBe(false);
    expect(wrapper.find(".show-card__title--playing").exists()).toBe(false);
  });

  it("marks the show on air and offers stop while a queue's dj runs it", () => {
    useShows().djStatus.value = onAir("livingroom");
    const wrapper = renderCard();

    expect(wrapper.find('[aria-label="Stop"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Play"]').exists()).toBe(false);
    expect(wrapper.find(".show-card__onair").exists()).toBe(true);
    expect(wrapper.find(".show-card__title--playing").exists()).toBe(true);
  });

  it("ignores a manually armed dj and other shows on air", () => {
    useShows().djStatus.value = {
      ...onAir("kitchen", ""),
      ...onAir("livingroom", "another_show"),
    };
    const wrapper = renderCard();

    expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
    expect(wrapper.find(".show-card__onair").exists()).toBe(false);
  });
});

describe("ShowCard play/stop", () => {
  it("plays the show as its radio item on the active player", async () => {
    const wrapper = renderCard();

    await wrapper.find('[aria-label="Play"]').trigger("click");
    await flushPromises();

    expect(playMedia).toHaveBeenCalledWith(showUri(show.id), undefined, {
      queue_id: "kitchen",
    });
  });

  it("prefers the show's default player over the active one", async () => {
    const wrapper = renderCard({ default_player_id: "bedroom" });

    await wrapper.find('[aria-label="Play"]').trigger("click");
    await flushPromises();

    expect(playMedia).toHaveBeenCalledWith(showUri(show.id), undefined, {
      queue_id: "bedroom",
    });
  });

  it("stops the show by clearing the queue it plays on", async () => {
    useShows().djStatus.value = onAir("livingroom");
    const wrapper = renderCard();

    await wrapper.find('[aria-label="Stop"]').trigger("click");
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith("player_queues/clear", {
      queue_id: "livingroom",
    });
    // Reflected right away; the queue events reconcile with the server later.
    expect(useShows().onAirQueueId(show.id)).toBeUndefined();
    expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
  });
});
