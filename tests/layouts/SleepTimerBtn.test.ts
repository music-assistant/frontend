import SleepTimerBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SleepTimerBtn.vue";
import type { Player as PlayerModel } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => {
  const api = { setSleepTimer: vi.fn(), clearSleepTimer: vi.fn() };
  return { api, default: api };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return { store: reactive({ activePlayer: undefined }) };
});

const mockStore = store as unknown as { activePlayer?: PlayerModel };

function playerWithSleepTimer(secondsLeft: number) {
  return {
    player_id: "p1",
    sleep_timer_expires_at: Date.now() / 1000 + secondsLeft,
  } as PlayerModel;
}

enableAutoUnmount(afterEach);

describe("SleepTimerBtn", () => {
  afterEach(() => {
    mockStore.activePlayer = undefined;
  });

  it("counts down in a button of its own while a timer runs", () => {
    mockStore.activePlayer = playerWithSleepTimer(3600);

    const button = mount(SleepTimerBtn);

    expect(button.get("button").text()).toMatch(/^\d{2}:\d{2}/);
  });

  it.each([
    { secondsLeft: 60, shown: true },
    // an expired timer is no timer, so the countdown goes with it
    { secondsLeft: -60, shown: false },
  ])("shows the countdown with $secondsLeft s left: $shown", (testCase) => {
    mockStore.activePlayer = playerWithSleepTimer(testCase.secondsLeft);

    expect(mount(SleepTimerBtn).find("button").exists()).toBe(testCase.shown);
  });

  it("shows nothing without an active player", () => {
    expect(mount(SleepTimerBtn).find("button").exists()).toBe(false);
  });
});
