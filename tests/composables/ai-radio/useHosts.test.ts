import { useHosts } from "@/composables/ai-radio/useHosts";
import { getPlayerMenuItems } from "@/helpers/player_menu_items";
import {
  PLAYER_CONTROL_NONE,
  PlayerType,
  type AIRadioHost,
  type Player,
  type PlayerQueue,
} from "@/plugins/api/interfaces";
import { store as storeModule } from "@/plugins/store";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    players: {},
    sendCommand,
  },
}));

// signed in as a member
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../../fixtures/scopes");
  return {
    authManager: {
      guestSessionKind: () => null,
      hasScope: scopeChecker(BUILTIN_ROLE_SCOPES.user),
    },
  };
});

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: vi.fn() },
}));

// the store must be reactive here: the prefetch hangs off a watch on the
// enabled plugins, which is exactly what this test exercises.
vi.mock("@/plugins/store", async () => {
  const { reactive } = await import("vue");
  return { store: reactive({ enabledPlugins: new Set<string>() }) };
});

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

// the real store computes these; on the mock they are plain writable state
const store = storeModule as typeof storeModule & {
  enabledPlugins: ReadonlySet<string>;
};

const host: AIRadioHost = {
  id: "host-1",
  name: "Robo DJ",
  instructions: "",
  tts_engine: "",
  language: "",
  options: {},
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

    store.enabledPlugins = new Set(["ai_radio"]);
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
