import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive, ref } from "vue";
import type { Player, PlayerQueue } from "@/plugins/api/interfaces";
import { playerQueue } from "../../tests/fixtures/playerQueue";
import { useMediaPlayState } from "./useMediaPlayState";

const { api, store } = vi.hoisted(() => ({
  api: {
    state: { value: "initialized" },
    queues: {} as Record<string, PlayerQueue>,
  },
  store: {
    activePlayer: undefined as
      Pick<Player, "player_id" | "active_source"> | undefined,
  },
}));
vi.mock("@/plugins/api", () => ({
  default: api,
  ConnectionState: { INITIALIZED: "initialized" },
}));
vi.mock("@/plugins/store", () => ({ store }));

describe("useMediaPlayState", () => {
  beforeEach(() => {
    api.state = ref("initialized");
    api.queues = reactive({});
    store.activePlayer = undefined;
  });

  it("tracks connection readiness and does not require a selected player", () => {
    const state = useMediaPlayState();
    expect(state.connected.value).toBe(true);
    expect(state.playActionInProgress.value).toBe(false);
    api.state.value = "reconnecting";
    expect(state.connected.value).toBe(false);
  });

  it.each(["queue", "external", ""])(
    "resolves pending play commands with active source %s",
    (source) => {
      store.activePlayer = { player_id: "speaker", active_source: source };
      api.queues.speaker = playerQueue({
        extra_attributes: { play_action_in_progress: false },
      });
      api.queues.queue = playerQueue({
        extra_attributes: { play_action_in_progress: false },
      });
      const state = useMediaPlayState();
      expect(state.playActionInProgress.value).toBe(false);
      const target = source === "queue" ? api.queues.queue : api.queues.speaker;
      target.extra_attributes!.play_action_in_progress = true;
      expect(state.playActionInProgress.value).toBe(true);
      target.extra_attributes!.play_action_in_progress = false;
      expect(state.playActionInProgress.value).toBe(false);
    },
  );
});
