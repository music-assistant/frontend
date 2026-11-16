import Default from "@/layouts/default/Default.vue";
import PlayerSelect from "@/layouts/default/PlayerSelect.vue";
import DashboardNowPlayingView from "@/views/DashboardNowPlayingView.vue";
import api from "@/plugins/api";
import {
  PlaybackState,
  type Player,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The now-playing dashboard in the layout, with the layout's link and the real
// PlayerSelect, which picks a player by itself when the selected one is not there.

const { authState, preferenceState } = vi.hoisted(() => ({
  authState: { dashboardViewer: false },
  preferenceState: {
    values: undefined as Record<string, unknown> | undefined,
  },
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await import("vue");
  const api = {
    players: reactive({}) as Record<string, Player>,
    providers: {},
  };
  return { default: api, api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await import("vue");
  const { api } = await import("@/plugins/api");
  return {
    store: reactive({
      activePlayerId: undefined as string | undefined,
      frameless: false,
      showFullscreenPlayer: false,
      showPlayersMenu: false,
      enabledPlugins: new Set<string>(),
      mobileLayout: false,
      get activePlayer(): Player | undefined {
        return this.activePlayerId
          ? api.players[this.activePlayerId]
          : undefined;
      },
    }),
  };
});

vi.mock("@/plugins/web_player", () => ({ webPlayer: { player_id: null } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/auth", () => ({
  authManager: {
    hasScope: () => true,
    isDashboardViewer: () => authState.dashboardViewer,
  },
}));
vi.mock("@/composables/usePlayPauseShortcut", () => ({
  usePlayPauseShortcut: () => undefined,
}));
vi.mock("@/composables/userPreferences", async () => {
  const { computed, reactive } = await import("vue");
  preferenceState.values = reactive({});
  return {
    useUserPreferences: () => ({
      getPreference: (key: string, defaultValue?: unknown) =>
        computed(() => preferenceState.values![key] ?? defaultValue),
      setPreference: async (key: string, value: unknown) => {
        preferenceState.values![key] = value;
      },
    }),
  };
});

function player(playerId: string, overrides: Partial<Player> = {}): Player {
  return {
    player_id: playerId,
    name: playerId,
    available: true,
    enabled: true,
    needs_setup: false,
    type: PlayerType.PLAYER,
    legacy_ids: [],
    output_protocols: [],
    can_group_with: [],
    group_members: [],
    playback_state: PlaybackState.IDLE,
    ...overrides,
  } as Player;
}

let router: Router;

async function mountDashboard(query: Record<string, string>) {
  await router.push({ path: "/now-playing", query });
  await router.isReady();
  const wrapper = mount(Default, {
    shallow: true,
    global: {
      plugins: [router],
      mocks: { $t: (key: string) => key },
      stubs: {
        VApp: { template: "<div><slot /></div>" },
        // the view renders the route before the PlayerSelect it mounts in every layout
        MainView: {
          setup: () => () => [h(DashboardNowPlayingView), h(PlayerSelect)],
        },
        DashboardNowPlayingView: false,
        PlayerSelect: false,
      },
    },
  });
  expect(wrapper.findComponent(DashboardNowPlayingView).exists()).toBe(true);
  return wrapper;
}

describe("Now-playing dashboard opened for a player", () => {
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    for (const playerId of Object.keys(api.players))
      delete api.players[playerId];
    for (const key of Object.keys(preferenceState.values!))
      delete preferenceState.values![key];
    store.activePlayerId = undefined;
    store.frameless = false;
    authState.dashboardViewer = false;
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/now-playing", component: { template: "<div />" } }],
    });
  });

  it("shows the player an old id was merged into, also after the players change", async () => {
    api.players.bath = player("bath");
    api.players.kitchen = player("kitchen", { legacy_ids: ["absorbed"] });
    await mountDashboard({ player: "absorbed" });
    await nextTick();
    expect(store.activePlayerId).toBe("kitchen");

    api.players.attic = player("attic");
    await nextTick();
    api.players.kitchen = player("kitchen", {
      legacy_ids: ["absorbed"],
      playback_state: PlaybackState.PLAYING,
    });
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("shows the unavailable player an old id was merged into", async () => {
    api.players.bath = player("bath");
    api.players.kitchen = player("kitchen", {
      legacy_ids: ["absorbed"],
      available: false,
    });
    await mountDashboard({ player: "absorbed" });
    await nextTick();
    expect(store.activePlayer).toBe(api.players.kitchen);

    // the link did not take the pin for the user's pick
    api.players.kitchen.available = true;
    await nextTick();
    api.players.attic = player("attic");
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("pins a listed, unavailable player by its current id", async () => {
    api.players.bath = player("bath");
    api.players.kitchen = player("kitchen", { available: false });
    await mountDashboard({ player: "kitchen" });
    await nextTick();

    expect(store.activePlayer).toBe(api.players.kitchen);
  });

  it("shows a player that is not there yet once it is usable", async () => {
    api.players.bath = player("bath");
    await mountDashboard({ player: "kitchen" });
    await nextTick();
    expect(store.activePlayerId).toBe("bath");

    api.players.kitchen = player("kitchen");
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("shows a player a display was cast for once it is listed, also unavailable", async () => {
    authState.dashboardViewer = true;
    api.players.bath = player("bath");
    await mountDashboard({ player: "kitchen" });
    await nextTick();
    expect(store.activePlayer).toBeUndefined();

    api.players.kitchen = player("kitchen", { available: false });
    await nextTick();

    expect(store.activePlayer).toBe(api.players.kitchen);
  });
});
