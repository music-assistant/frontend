import Default from "@/layouts/default/Default.vue";
import PlayerSelect from "@/layouts/default/PlayerSelect.vue";
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
    store.frameless = false;
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

  it("keeps a player the user picked while the linked player was usable", async () => {
    api.players.kitchen = player("kitchen");
    api.players.living = player("living");
    api.players.bath = player("bath");
    await mountLayout({ player: "kitchen" });
    expect(store.activePlayerId).toBe("kitchen");

    store.activePlayerId = "living";
    await nextTick();
    api.players.attic = player("attic");
    await nextTick();
    api.players.kitchen.available = false;
    await nextTick();
    api.players.kitchen.available = true;
    await nextTick();
    delete api.players.kitchen;
    await nextTick();
    api.players.bath = player("bath", { legacy_ids: ["kitchen"] });
    await nextTick();

    expect(store.activePlayerId).toBe("living");
  });

  it("keeps a player the user picked just before the linked player went away", async () => {
    api.players.kitchen = player("kitchen");
    api.players.living = player("living");
    await mountLayout({ player: "kitchen" });

    store.activePlayerId = "living";
    delete api.players.kitchen;
    await nextTick();
    api.players.kitchen = player("kitchen");
    await nextTick();

    expect(store.activePlayerId).toBe("living");
  });

  it("selects the player of a new link after the user picked another one", async () => {
    api.players.kitchen = player("kitchen");
    api.players.living = player("living");
    api.players.bath = player("bath");
    await mountLayout({ player: "kitchen" });
    store.activePlayerId = "living";
    await nextTick();

    await router.push({ path: "/", query: { player: "bath" } });
    await nextTick();

    expect(store.activePlayerId).toBe("bath");
  });

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
