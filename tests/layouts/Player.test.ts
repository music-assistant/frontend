import Player from "@/layouts/default/PlayerOSD/Player.vue";
import PlayerBarMobileVolumeSheet from "@/layouts/default/PlayerOSD/PlayerBarMobileVolumeSheet.vue";
import PlayerTrackDetails from "@/layouts/default/PlayerOSD/PlayerTrackDetails.vue";
import PlayerTrackMenu from "@/layouts/default/PlayerOSD/PlayerControlBtn/PlayerTrackMenu.vue";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import type { Player as PlayerModel } from "@/plugins/api/interfaces";
import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { nextTick, shallowReactive } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

const routeState = vi.hoisted(() => ({
  current: null as { matched: { name?: string }[] } | null,
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRoute: () => routeState.current,
}));

vi.mock("@/plugins/router", () => ({ default: { push: vi.fn() } }));

vi.mock("@/plugins/api", () => ({
  default: { toggleFavorite: vi.fn() },
}));

vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: () => false,
}));

vi.mock("@/plugins/vuetify", () => ({
  default: { theme: { current: { value: { dark: false } } } },
}));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      activePlayerId: undefined,
      curQueueItem: undefined,
    }),
  };
});

let wrapper: VueWrapper | undefined;

function mountPlayer(useFloatingPlayer: boolean) {
  wrapper = shallowMount(Player, {
    props: { useFloatingPlayer },
    global: {
      mocks: { $vuetify: { theme: { current: { dark: false } } } },
    },
  });
  return wrapper;
}

describe("Player mobile settings compaction", () => {
  afterEach(async () => {
    wrapper?.unmount();
    wrapper = undefined;
    routeState.current = null;
    const { store } = await import("@/plugins/store");
    (store as unknown as { activePlayer?: PlayerModel }).activePlayer =
      undefined;
  });

  it("renders the full floating player outside settings", async () => {
    const { store } = await import("@/plugins/store");
    (store as unknown as { activePlayer?: PlayerModel }).activePlayer = {
      player_id: "p1",
    } as PlayerModel;
    routeState.current = shallowReactive({ matched: [{ name: "discover" }] });
    const player = mountPlayer(true);

    expect(
      player.find(".mediacontrols-mobile-container").attributes("data-compact"),
    ).toBe("false");
    expect(player.findComponent(PlayerTrackMenu).exists()).toBe(true);
    expect(player.findComponent(PlayerVolume).exists()).toBe(true);
    expect(player.findComponent(PlayerTrackDetails).props("compact")).toBe(
      false,
    );
  });

  it("collapses to a compact single row on settings and its descendants", async () => {
    const { store } = await import("@/plugins/store");
    (store as unknown as { activePlayer?: PlayerModel }).activePlayer = {
      player_id: "p1",
    } as PlayerModel;
    routeState.current = shallowReactive({
      matched: [{ name: "settings" }, { name: "profile" }],
    });
    const player = mountPlayer(true);

    expect(
      player.find(".mediacontrols-mobile-container").attributes("data-compact"),
    ).toBe("true");
    expect(player.findComponent(PlayerTrackMenu).exists()).toBe(false);
    expect(player.findComponent(PlayerVolume).exists()).toBe(false);
    expect(player.findComponent(PlayerBarMobileVolumeSheet).exists()).toBe(
      false,
    );
    expect(player.findComponent(PlayerTrackDetails).props("compact")).toBe(
      true,
    );
  });

  it("leaves the desktop player unaffected on settings routes", () => {
    routeState.current = shallowReactive({ matched: [{ name: "settings" }] });
    const player = mountPlayer(false);

    expect(player.find(".mediacontrols-mobile-container").exists()).toBe(false);
    expect(player.find(".mediacontrols-bg").attributes("data-floating")).toBe(
      "false",
    );
  });

  it("resets an open volume sheet on entering settings so it cannot resurface", async () => {
    const { store } = await import("@/plugins/store");
    (store as unknown as { activePlayer?: PlayerModel }).activePlayer = {
      player_id: "p1",
    } as PlayerModel;
    routeState.current = shallowReactive({ matched: [{ name: "discover" }] });
    const player = mountPlayer(true);

    await player.findComponent(PlayerVolume).vm.$emit("toggle-group-expansion");
    await nextTick();
    expect(player.findComponent(PlayerBarMobileVolumeSheet).props("open")).toBe(
      true,
    );

    // entering settings unmounts the sheet, but the open state must not
    // survive to reopen it once the normal player returns
    routeState.current.matched = [{ name: "settings" }];
    await nextTick();
    expect(player.findComponent(PlayerBarMobileVolumeSheet).exists()).toBe(
      false,
    );

    routeState.current.matched = [{ name: "discover" }];
    await nextTick();
    expect(player.findComponent(PlayerBarMobileVolumeSheet).props("open")).toBe(
      false,
    );
  });
});
