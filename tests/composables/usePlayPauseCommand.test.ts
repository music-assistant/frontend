import { usePlayPauseCommand } from "@/composables/usePlayPauseCommand";
import api from "@/plugins/api";
import {
  PlaybackState,
  type Player,
  type PlayerQueue,
  type PlayerSource,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { playerSource } from "../fixtures/playerSource";

vi.mock("@/plugins/api", () => {
  const api = { playerCommandPlayPause: vi.fn(), playerCommandStop: vi.fn() };
  return { api, default: api };
});

vi.mock("@/plugins/store", () => ({ store: { curQueueItem: undefined } }));

const playerCommandPlayPause = vi.mocked(api.playerCommandPlayPause);

/** An idle player whose active source stopped, as the server publishes it. */
function idlePlayerOn(source: PlayerSource): Player {
  return {
    player_id: "player-1",
    playback_state: PlaybackState.IDLE,
    active_source: source.id,
    source_list: [source],
    current_media: null,
  } as unknown as Player;
}

function command(player: Player) {
  return usePlayPauseCommand(ref(player), ref<PlayerQueue | undefined>());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePlayPauseCommand", () => {
  it("offers play to restart a stopped source that can't pause", () => {
    const lineIn = playerSource({
      id: "sendspin_source://audio_source/client-1",
      passive: false,
    });
    const { isDisabled, playPause } = command(idlePlayerOn(lineIn));

    expect(isDisabled.value).toBe(false);
    playPause();
    expect(playerCommandPlayPause).toHaveBeenCalledWith("player-1");
  });

  it("keeps play disabled for a passive source", () => {
    const { isDisabled } = command(idlePlayerOn(playerSource()));

    expect(isDisabled.value).toBe(true);
  });

  it("keeps play disabled for an empty queue", () => {
    const queue = playerSource({
      id: "player-1",
      name: "Music Assistant Queue",
      passive: false,
    });
    const { isDisabled } = command(idlePlayerOn(queue));

    expect(isDisabled.value).toBe(true);
  });
});
