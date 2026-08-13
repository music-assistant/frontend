import Player from "@/layouts/default/PlayerOSD/Player.vue";
import PlayerBarGroupControl from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue";
import PlayerBarMobileVolumeSheet from "@/layouts/default/PlayerOSD/PlayerBarMobileVolumeSheet.vue";
import PlayerExtendedControls from "@/layouts/default/PlayerOSD/PlayerExtendedControls.vue";
import PlayerTrackDetails from "@/layouts/default/PlayerOSD/PlayerTrackDetails.vue";
import FavoriteMenuBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/FavoriteMenuBtn.vue";
import QueueBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/QueueBtn.vue";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import type { Player as PlayerModel } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/router", () => ({ default: { push: vi.fn() } }));

vi.mock("@/plugins/api", () => {
  const api = { subscribe: vi.fn(() => () => {}), providers: {}, players: {} };
  return { api, default: api };
});

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

// the real store derives the active player from the api players map, so the
// mock is what makes these writable per test
const mockStore = store as unknown as {
  activePlayer?: PlayerModel;
  activePlayerId?: string;
};

// bp7: the width from which the desktop action row has room for the sleep timer
const SLEEP_TIMER_BREAKPOINT = 1100;

// the width below which the floating bar takes over from the desktop one, so
// the narrowest the desktop bar is ever laid out at
const NARROWEST_DESKTOP_BAR = 769;

const originalInnerWidth = Object.getOwnPropertyDescriptor(
  window,
  "innerWidth",
);

let wrapper: VueWrapper | undefined;

// the breakpoint plugin keeps the width in a module-level reactive that only
// the resize event refreshes
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
  window.dispatchEvent(new Event("resize"));
}

function mountPlayer(useFloatingPlayer: boolean) {
  wrapper = shallowMount(Player, {
    props: { useFloatingPlayer },
    global: {
      mocks: { $vuetify: { theme: { current: { dark: false } } } },
    },
  });
  return wrapper;
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  mockStore.activePlayer = undefined;
  mockStore.activePlayerId = undefined;
  if (originalInnerWidth) {
    Object.defineProperty(window, "innerWidth", originalInnerWidth);
  }
  window.dispatchEvent(new Event("resize"));
});

describe("Player floating mobile bar", () => {
  it("carries the grouping control, the volume slider and its sheet", () => {
    mockStore.activePlayer = { player_id: "p1" } as PlayerModel;
    const player = mountPlayer(true);

    expect(player.findComponent(PlayerBarGroupControl).props("floating")).toBe(
      true,
    );
    expect(player.find(".volume-slider").exists()).toBe(true);
    expect(player.findComponent(PlayerVolume).exists()).toBe(true);
    expect(player.findComponent(PlayerBarMobileVolumeSheet).exists()).toBe(
      true,
    );
  });

  it("sizes the track details down to fit the shallow bar", () => {
    mockStore.activePlayer = { player_id: "p1" } as PlayerModel;
    const player = mountPlayer(true);

    expect(player.findComponent(PlayerTrackDetails).props("compact")).toBe(
      true,
    );
  });

  it("closes an open volume sheet when the active player changes", async () => {
    mockStore.activePlayer = { player_id: "p1" } as PlayerModel;
    mockStore.activePlayerId = "p1";
    const player = mountPlayer(true);

    await player.findComponent(PlayerVolume).vm.$emit("toggle-group-expansion");
    await nextTick();
    expect(player.findComponent(PlayerBarMobileVolumeSheet).props("open")).toBe(
      true,
    );

    // the sheet controls the volume of the player it was opened for, so it
    // must not stay open over a player switch
    mockStore.activePlayer = { player_id: "p2" } as PlayerModel;
    mockStore.activePlayerId = "p2";
    await nextTick();
    expect(player.findComponent(PlayerBarMobileVolumeSheet).props("open")).toBe(
      false,
    );
  });
});

describe("Player desktop bar", () => {
  it("leaves the desktop player outside the floating container", () => {
    const player = mountPlayer(false);

    expect(player.find(".mediacontrols-mobile-container").exists()).toBe(false);
    expect(player.find(".mediacontrols-bg").attributes("data-floating")).toBe(
      "false",
    );
  });

  it.each([
    { width: SLEEP_TIMER_BREAKPOINT, visible: true },
    { width: SLEEP_TIMER_BREAKPOINT - 1, visible: false },
  ])("offers the sleep timer at $width px: $visible", ({ width, visible }) => {
    mockStore.activePlayer = { player_id: "p1" } as PlayerModel;
    setViewportWidth(width);
    const player = mountPlayer(false);

    expect(
      player.findComponent(PlayerExtendedControls).props("sleepTimer"),
    ).toEqual({ isVisible: visible });
  });

  // the favourite and queue buttons flank the transport controls at every width
  // the desktop bar is laid out at - narrower than this it is not the bar in use
  it.each([NARROWEST_DESKTOP_BAR, 1500])(
    "keeps the favourite and queue buttons at %i px",
    (width) => {
      mockStore.activePlayer = { player_id: "p1" } as PlayerModel;
      setViewportWidth(width);
      const player = mountPlayer(false);

      expect(player.findComponent(FavoriteMenuBtn).exists()).toBe(true);
      expect(player.findComponent(QueueBtn).exists()).toBe(true);
    },
  );
});
