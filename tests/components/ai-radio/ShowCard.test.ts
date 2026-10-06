import ShowCard from "@/components/ai-radio/ShowCard.vue";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { showUri, useShows } from "@/composables/ai-radio/useShows";
import api, { type MusicAssistantApi } from "@/plugins/api";
import type { AIRadioStation, Scope, Player } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../fixtures/scopes";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { guestSessionKind: () => null, hasScope },
}));

const { playMedia, sendCommand } = vi.hoisted(() => ({
  playMedia: vi.fn(async () => undefined),
  sendCommand: vi.fn(
    async (_command?: string, _args?: Record<string, unknown>) => ({}),
  ),
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
  store: { activePlayerId: "kitchen", enabledPlugins: new Set<string>() },
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

  it("prefers the show's default player over the active one while it is available", async () => {
    api.players.bedroom = { player_id: "bedroom", available: true } as Player;
    const wrapper = renderCard({ default_player_id: "bedroom" });

    await wrapper.find('[aria-label="Play"]').trigger("click");
    await flushPromises();

    expect(playMedia).toHaveBeenCalledWith(showUri(show.id), undefined, {
      queue_id: "bedroom",
    });
    delete api.players.bedroom;
  });

  it("falls back to the active player when the default device is unavailable", async () => {
    api.players.bedroom = { player_id: "bedroom", available: false } as Player;
    const wrapper = renderCard({ default_player_id: "bedroom" });

    await wrapper.find('[aria-label="Play"]').trigger("click");
    await flushPromises();

    expect(playMedia).toHaveBeenCalledWith(showUri(show.id), undefined, {
      queue_id: "kitchen",
    });
    delete api.players.bedroom;
  });

  it("stops the show by clearing the queue it plays on", async () => {
    useShows().djStatus.value = onAir("livingroom");
    // stopShow re-checks live status right before clearing; report the show
    // still on air so the clear actually happens.
    sendCommand.mockImplementation(async (command) =>
      command === "ai_radio/queue_dj/status" ? onAir("livingroom") : {},
    );
    const wrapper = renderCard();

    await wrapper.find('[aria-label="Stop"]').trigger("click");
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith(
      "player_queues/clear",
      { queue_id: "livingroom" },
      { suppressGlobalError: true },
    );
    // Reflected right away; the queue events reconcile with the server later.
    expect(useShows().onAirQueueId(show.id)).toBeUndefined();
    expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
  });
});

describe("ShowCard editing rights", () => {
  // the stubs render their slots, so the menu entries show up as well
  const mountCard = () =>
    mount(ShowCard, {
      props: { show },
      shallow: true,
      global: { renderStubDefaultSlot: true },
    });

  it("lets an admin customize, duplicate and delete the show", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    const wrapper = mountCard();

    expect(wrapper.findAllComponents(DropdownMenuItem)).toHaveLength(3);
    expect(wrapper.attributes("role")).toBe("button");
    await wrapper.trigger("click");
    expect(wrapper.emitted("customize")).toEqual([[show.id]]);
  });

  it.each([
    ["a member", BUILTIN_ROLE_SCOPES.user],
    ["a guest", BUILTIN_ROLE_SCOPES.guest],
  ])("leaves %s only the play button", async (_role, scopes) => {
    hasScope.mockImplementation(scopeChecker(scopes));
    const wrapper = mountCard();

    expect(wrapper.findComponent(DropdownMenu).exists()).toBe(false);
    expect(wrapper.attributes("role")).toBeUndefined();
    await wrapper.trigger("click");
    expect(wrapper.emitted("customize")).toBeUndefined();
    expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
  });
});
