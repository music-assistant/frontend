import PlayerExtendedControls from "@/layouts/default/PlayerOSD/PlayerExtendedControls.vue";
import SleepTimerBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SleepTimerBtn.vue";
import type { Player as PlayerModel } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { enableAutoUnmount, mount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => {
  const api = { toggleFavorite: vi.fn(), providers: {}, players: {} };
  return { api, default: api };
});

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

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

// the countdown only renders while the timer still has time to run
function playerWithSleepTimer() {
  return {
    player_id: "p1",
    sleep_timer_expires_at: Date.now() / 1000 + 3600,
  } as PlayerModel;
}

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
      mockStore.activePlayer = playerWithSleepTimer();

      const controls = shallowMount(PlayerExtendedControls, {
        props: { sleepTimer: { isVisible } },
      });

      expect(controls.findComponent(SleepTimerBtn).exists()).toBe(present);
    },
  );

  it("puts the sleep timer in the row as a button of its own", () => {
    mockStore.activePlayer = playerWithSleepTimer();

    // the real countdown, so what the layout reads is checked past the
    // fallthrough attrs the component forwards
    const controls = mount(PlayerExtendedControls, {
      global: {
        stubs: {
          PlayerBarVolumeControl: true,
          PlayerBarGroupControl: true,
          PlayerBarPlayerButton: true,
        },
      },
    });

    // the gap between the actions is spaced with `button ~ button`, so the
    // countdown only takes its share of the row while it renders as one
    expect(controls.find(".player-bar-action-row > button").exists()).toBe(
      true,
    );
  });
});
