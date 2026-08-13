import { useHosts } from "@/composables/ai-radio/useHosts";
import { getPlayerMenuItems } from "@/helpers/player_menu_items";
import api from "@/plugins/api";
import {
  PLAYER_CONTROL_NONE,
  PlayerType,
  type AIRadioHost,
  type Player,
  type PlayerQueue,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn(),
}));

// api.providers must be reactive here: the prefetch hangs off a watch on the
// provider list, which is exactly what this test exercises.
vi.mock("@/plugins/api", async () => {
  const { reactive } = await import("vue");
  return {
    default: {
      players: {},
      providers: reactive<Record<string, ProviderInstance>>({}),
      sendCommand,
    },
  };
});

vi.mock("@/plugins/auth", () => ({
  authManager: { isAdmin: () => false },
}));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: vi.fn() },
}));

vi.mock("@/plugins/store", () => ({
  store: {},
}));

vi.mock("@/helpers/sleep_timer", () => ({
  getSleepTimerMenuItem: vi.fn(),
  sleepTimerActive: () => false,
}));

vi.mock("@/composables/useAudioOverlay", () => ({
  useAudioOverlay: () => ({
    openOverlayDialog: vi.fn(),
    overlayAvailable: { value: false },
  }),
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const host: AIRadioHost = {
  id: "host-1",
  name: "Robo DJ",
  instructions: "",
  tts_engine: "",
  language: "",
  section_ids: [],
  section_order: [],
  merge_section_id: "",
};

sendCommand.mockImplementation(async (command: string) => {
  if (command === "ai_radio/hosts/list") return [host];
  if (command === "ai_radio/queue_dj/status") return { kitchen: "host-1" };
  return undefined;
});

const player = {
  player_id: "kitchen",
  type: PlayerType.PLAYER,
  power_control: PLAYER_CONTROL_NONE,
  supported_features: [],
  source_list: [],
  sound_mode_list: [],
  options: [],
  needs_setup: false,
} as unknown as Player;

const queue = {
  queue_id: "kitchen",
  active: true,
  items: 0,
} as PlayerQueue;

describe("useHosts queue dj prefetch", () => {
  it("warms the ai dj caches on provider availability, so the first menu open lists the hosts", async () => {
    // Nothing is seeded: whatever the menu renders comes from the prefetch.
    expect(useHosts().hosts.value).toEqual([]);
    expect(sendCommand).not.toHaveBeenCalled();

    api.providers["ai_radio--1"] = {
      domain: "ai_radio",
      available: true,
    } as ProviderInstance;
    await flushPromises();

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/hosts/list");
    expect(sendCommand).toHaveBeenCalledWith("ai_radio/queue_dj/status");

    // First build of the menu after page load, i.e. the one that used to show
    // an empty host list with a wrongly checked "Off".
    const aiDj = getPlayerMenuItems(player, queue, { context: "queue" }).find(
      (item) => item.label === "ai_dj",
    );

    expect(aiDj?.subItems?.map((item) => item.label)).toEqual([
      "Robo DJ",
      "ai_dj_off",
    ]);
    expect(
      aiDj?.subItems?.find((item) => item.label === "ai_dj_off")?.selected,
    ).toBe(false);

    // Let the menu's own refresh calls settle before the test ends.
    await flushPromises();
  });
});
