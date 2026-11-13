import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import type { Player, PlayerQueue } from "@/plugins/api/interfaces";
import { playerQueue } from "../../tests/fixtures/playerQueue";
import { usePlayActionInProgress } from "./usePlayActionInProgress";

const { api, store } = vi.hoisted(() => ({
  api: { queues: {} as Record<string, PlayerQueue> },
  store: {
    activePlayer: undefined as
      Pick<Player, "player_id" | "active_source"> | undefined,
  },
}));
vi.mock("@/plugins/api", () => ({ default: api }));
vi.mock("@/plugins/store", () => ({ store }));

const setBusy = (queueId: string, busy: boolean) => {
  api.queues[queueId].extra_attributes!.play_action_in_progress = busy;
};

describe("usePlayActionInProgress", () => {
  beforeEach(() => {
    api.queues = reactive({
      speaker: playerQueue({ extra_attributes: {} }),
      group: playerQueue({ extra_attributes: {} }),
    });
    store.activePlayer = undefined;
  });

  it("is not busy without an active player", () => {
    expect(usePlayActionInProgress().value).toBe(false);
  });

  // a grouped player that plays alone uses its own queue, everything else the group's
  it.each(["speaker", "group"])(
    "shows a grouped player's play action on queue %s",
    (queueId) => {
      store.activePlayer = { player_id: "speaker", active_source: "group" };
      const busy = usePlayActionInProgress();
      expect(busy.value).toBe(false);
      setBusy(queueId, true);
      expect(busy.value).toBe(true);
      setBusy(queueId, false);
      expect(busy.value).toBe(false);
    },
  );

  it.each(["speaker", "external", ""])(
    "shows an ungrouped player's play action with active source %s",
    (source) => {
      store.activePlayer = { player_id: "speaker", active_source: source };
      const busy = usePlayActionInProgress();
      expect(busy.value).toBe(false);
      setBusy("speaker", true);
      expect(busy.value).toBe(true);
    },
  );

  it("ignores another queue's play action", () => {
    store.activePlayer = { player_id: "speaker", active_source: "speaker" };
    setBusy("group", true);
    expect(usePlayActionInProgress().value).toBe(false);
  });
});
