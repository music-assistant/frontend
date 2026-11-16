import Default from "@/layouts/default/Default.vue";
import View from "@/layouts/default/View.vue";
import Footer from "@/layouts/default/Footer.vue";
import api from "@/plugins/api";
import { type Player, PlayerType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { type VueWrapper, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      frameless: false,
      activePlayerId: undefined,
      showFullscreenPlayer: false,
      enabledPlugins: new Set<string>(),
    }),
  };
});

const vuetify = createVuetify({ components, directives });

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/", component: { template: "<div />" } }],
});

let wrapper: VueWrapper | undefined;

async function mountLayout(query: Record<string, string> = {}) {
  await router.push({ path: "/", query });
  await router.isReady();
  wrapper = mount(Default, {
    shallow: true,
    global: {
      plugins: [vuetify, router],
      // v-app hosts the whole tree, so it has to render its slot
      stubs: { VApp: { template: "<div><slot /></div>" } },
    },
  });
  return wrapper;
}

/** A player that can become the active one. */
function selectablePlayer(playerId: string, legacyIds: string[] = []): Player {
  return {
    player_id: playerId,
    name: playerId,
    type: PlayerType.PLAYER,
    enabled: true,
    available: true,
    needs_setup: false,
    legacy_ids: legacyIds,
  } as Player;
}

describe("Default layout", () => {
  beforeEach(() => {
    store.frameless = false;
    store.activePlayerId = undefined;
    for (const playerId of Object.keys(api.players))
      delete api.players[playerId];
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("drops the player chrome in frameless mode", async () => {
    const layout = await mountLayout();
    expect(layout.findComponent(Footer).exists()).toBe(true);

    store.frameless = true;
    await nextTick();

    expect(layout.findComponent(Footer).exists()).toBe(false);
  });

  it("keeps the view mounted across a frameless toggle", async () => {
    const layout = await mountLayout();
    // the party dashboard lives in here and holds a wake lock, a burn-in timer
    // and fetched config, so going fullscreen must not restart it
    const view = layout.findComponent(View).element;

    store.frameless = true;
    await nextTick();

    expect(layout.findComponent(View).element).toBe(view);
  });

  it("selects the player a link names", async () => {
    api.players.kitchen = selectablePlayer("kitchen");

    await mountLayout({ player: "kitchen" });

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("selects the player a link names by an id it had before a merge", async () => {
    api.players.kitchen = selectablePlayer("kitchen", ["absorbed"]);

    await mountLayout({ player: "absorbed" });

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("selects the linked player once the server lists it", async () => {
    await mountLayout({ player: "absorbed" });
    expect(store.activePlayerId).toBeUndefined();

    api.players.kitchen = selectablePlayer("kitchen", ["absorbed"]);
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("selects the linked player once it becomes available", async () => {
    api.players.kitchen = { ...selectablePlayer("kitchen"), available: false };

    await mountLayout({ player: "kitchen" });
    expect(store.activePlayerId).toBeUndefined();

    api.players.kitchen.available = true;
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("selects the linked player once it gets the old id the link names", async () => {
    api.players.kitchen = selectablePlayer("kitchen");
    api.players.absorbed = {
      ...selectablePlayer("absorbed"),
      available: false,
    };

    await mountLayout({ player: "absorbed" });
    expect(store.activePlayerId).toBeUndefined();

    // the server removes the absorbed player before it updates the one it merged into
    delete api.players.absorbed;
    await nextTick();
    api.players.kitchen = selectablePlayer("kitchen", ["absorbed"]);
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("follows the linked player into the player it is merged into", async () => {
    api.players.kitchen = selectablePlayer("kitchen");
    api.players.absorbed = selectablePlayer("absorbed");

    await mountLayout({ player: "absorbed" });
    expect(store.activePlayerId).toBe("absorbed");

    delete api.players.absorbed;
    await nextTick();
    api.players.kitchen = selectablePlayer("kitchen", ["absorbed"]);
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });

  it("selects the linked player again when the players change, as before", async () => {
    api.players.kitchen = selectablePlayer("kitchen");
    api.players.living = selectablePlayer("living");
    await mountLayout({ player: "kitchen" });
    store.activePlayerId = "living";

    api.players.bath = selectablePlayer("bath");
    await nextTick();

    expect(store.activePlayerId).toBe("kitchen");
  });
});
