import Default from "@/layouts/default/Default.vue";
import PlayerSelect from "@/layouts/default/PlayerSelect.vue";
import api from "@/plugins/api";
import {
  PlaybackState,
  type Player,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { h, nextTick } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The link of the layout together with the real PlayerSelect, which picks a
// player by itself when the selected one goes away.

const { preferenceState } = vi.hoisted(() => ({
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
      companionPlayerId: undefined as string | undefined,
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

vi.mock("@/plugins/web_player", async () => {
  const { reactive } = await import("vue");
  return { webPlayer: reactive({ player_id: null as string | null }) };
});
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => true, isDashboardViewer: () => false },
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

async function mountLayout(query: Record<string, string>) {
  await router.push({ path: "/", query });
  await router.isReady();
  const wrapper = mount(Default, {
    shallow: true,
    global: {
      plugins: [router],
      mocks: { $t: (key: string) => key },
      stubs: {
        VApp: { template: "<div><slot /></div>" },
        // the view mounts the real PlayerSelect, in every layout
        MainView: { setup: () => () => h(PlayerSelect) },
        PlayerSelect: false,
      },
    },
  });
  expect(wrapper.findComponent(PlayerSelect).exists()).toBe(true);
  return wrapper;
}

describe("Default layout link with the automatic player pick", () => {
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    for (const playerId of Object.keys(api.players))
      delete api.players[playerId];
    for (const key of Object.keys(preferenceState.values!))
      delete preferenceState.values![key];
    store.activePlayerId = undefined;
    store.companionPlayerId = undefined;
    store.frameless = false;
    webPlayer.player_id = null;
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: { template: "<div />" } }],
    });
  });

  it.each([
    ["", {}],
    [" in the frameless layout", { frameless: "" }],
  ])(
    "selects the linked player again when it returns after the picker fell back%s",
    async (_layout, query) => {
      api.players.kitchen = player("kitchen");
      api.players.living = player("living");
      await mountLayout({ player: "kitchen", ...query });
      expect(store.activePlayerId).toBe("kitchen");

      delete api.players.kitchen;
      await nextTick();
      expect(store.activePlayerId).toBe("living");

      api.players.kitchen = player("kitchen");
      await nextTick();

      expect(store.activePlayerId).toBe("kitchen");
    },
  );

  it.each([
    ["", {}],
    [" in the frameless layout", { frameless: "" }],
  ])(
    "follows the linked player into the player it is merged into after the picker fell back%s",
    async (_layout, query) => {
      api.players.absorbed = player("absorbed");
      api.players.bath = player("bath");
      api.players.kitchen = player("kitchen");
      await mountLayout({ player: "absorbed", ...query });
      expect(store.activePlayerId).toBe("absorbed");

      // the server removes the absorbed player before it updates the one it merged into
      delete api.players.absorbed;
      await nextTick();
      expect(store.activePlayerId).toBe("bath");
      api.players.kitchen = player("kitchen", { legacy_ids: ["absorbed"] });
      await nextTick();

      expect(store.activePlayerId).toBe("kitchen");
    },
  );

  it.each(["web", "companion"])(
    "selects the merge survivor again after the %s player took over from the fallback",
    async (builtin) => {
      api.players.absorbed = player("absorbed");
      api.players.kitchen = player("kitchen");
      await mountLayout({ player: "absorbed" });
      expect(store.activePlayerId).toBe("absorbed");

      // the picker falls back to the player the absorbed one is merged into next
      delete api.players.absorbed;
      await nextTick();
      expect(store.activePlayerId).toBe("kitchen");
      api.players.kitchen = player("kitchen", { legacy_ids: ["absorbed"] });
      await nextTick();

      // the picker hands its own pick over to the built-in player once it registers
      api.players.builtin = player("builtin");
      if (builtin === "web") webPlayer.player_id = "builtin";
      else store.companionPlayerId = "builtin";
      await nextTick();
      expect(store.activePlayerId).toBe("builtin");
      api.players.attic = player("attic");
      await nextTick();

      expect(store.activePlayerId).toBe("kitchen");
    },
  );

  it("selects a linked player that is not usable yet once it is", async () => {
    api.players.kitchen = player("kitchen", { available: false });
    api.players.living = player("living");
    await mountLayout({ player: "kitchen" });
    // nothing selected yet: the picker falls back as soon as the players change
    api.players.attic = player("attic");
    await nextTick();
    expect(store.activePlayerId).toBe("living");

    api.players.kitchen.available = true;
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });
});
