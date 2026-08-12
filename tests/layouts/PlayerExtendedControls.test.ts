import PlayerExtendedControls from "@/layouts/default/PlayerOSD/PlayerExtendedControls.vue";
import SleepTimerBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SleepTimerBtn.vue";
import type { Player as PlayerModel } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => {
  const api = { toggleFavorite: vi.fn(), providers: {}, players: {} };
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      curQueueItem: undefined,
    }),
  };
});

const mockStore = store as unknown as { activePlayer?: PlayerModel };

enableAutoUnmount(afterEach);

describe("PlayerExtendedControls", () => {
  afterEach(() => {
    mockStore.activePlayer = undefined;
  });

  it.each([
    { isVisible: true, present: true },
    { isVisible: false, present: false },
  ])(
    "renders the sleep timer for isVisible $isVisible: $present",
    ({ isVisible, present }) => {
      mockStore.activePlayer = { player_id: "p1" } as PlayerModel;

      const controls = shallowMount(PlayerExtendedControls, {
        props: { sleepTimer: { isVisible } },
      });

      expect(controls.findComponent(SleepTimerBtn).exists()).toBe(present);
    },
  );

  it("marks the sleep timer so the row can budget for it", () => {
    mockStore.activePlayer = { player_id: "p1" } as PlayerModel;

    const controls = shallowMount(PlayerExtendedControls);

    // the action widths key off this class to make room for the countdown
    expect(controls.findComponent(SleepTimerBtn).classes()).toContain(
      "player-bar-sleep-timer",
    );
  });
});
