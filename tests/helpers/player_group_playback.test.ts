import {
  requestGroupPlaybackConfirmation,
  togglePlayerPower,
} from "@/helpers/player_group_playback";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  type Player,
  PlaybackState,
  type PlayerQueue,
  PlayerType,
} from "@/plugins/api/interfaces";
import {
  eventbus,
  type PlayerGroupPlaybackDialogEvent,
} from "@/plugins/eventbus";
import { playerQueue } from "../fixtures/playerQueue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, callbacks, storeMock, unsubscribe } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, Player>,
    queues: {} as Record<string, PlayerQueue>,
    playerCommandPower: vi.fn<MusicAssistantApi["playerCommandPower"]>(),
    playerCommandSetMembers:
      vi.fn<MusicAssistantApi["playerCommandSetMembers"]>(),
    subscribe_multi: vi.fn(),
  },
  callbacks: [] as CallableFunction[],
  storeMock: {
    activePlayerId: undefined as string | undefined,
  },
  unsubscribe: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "leader",
    type: PlayerType.PLAYER,
    name: "Kitchen",
    available: true,
    powered: true,
    group_members: ["leader", "child"],
    synced_to: null,
    active_source: "leader",
    ...overrides,
  } as Player;
}

function setActiveGroup(state = PlaybackState.PLAYING) {
  const leader = createPlayer();
  const child = createPlayer({
    player_id: "child",
    name: "Office",
    group_members: [],
    synced_to: leader.player_id,
    active_source: leader.player_id,
  });
  apiMock.players = {
    [leader.player_id]: leader,
    [child.player_id]: child,
  };
  apiMock.queues = {
    [leader.player_id]: playerQueue({
      queue_id: leader.player_id,
      state,
    }),
  };
  return { child, leader };
}

let dialogEvent: PlayerGroupPlaybackDialogEvent | undefined;
const captureDialog = (event: PlayerGroupPlaybackDialogEvent) => {
  dialogEvent = event;
};

describe("player group playback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callbacks.length = 0;
    apiMock.players = {};
    apiMock.queues = {};
    apiMock.playerCommandPower.mockResolvedValue();
    apiMock.playerCommandSetMembers.mockResolvedValue();
    apiMock.subscribe_multi.mockImplementation((_events, callback) => {
      callbacks.push(callback);
      return unsubscribe;
    });
    storeMock.activePlayerId = undefined;
    dialogEvent = undefined;
    eventbus.on("playerGroupPlaybackDialog", captureDialog);
  });

  afterEach(() => {
    eventbus.off("playerGroupPlaybackDialog", captureDialog);
  });

  it.each([PlaybackState.PLAYING, PlaybackState.PAUSED])(
    "asks what to do with an active %s queue",
    (state) => {
      const { leader } = setActiveGroup(state);

      expect(requestGroupPlaybackConfirmation(leader, "remove", vi.fn())).toBe(
        true,
      );
      expect(dialogEvent).toMatchObject({
        change: "remove",
        playerName: leader.name,
      });
    },
  );

  it("does not ask when the server cannot transfer playback", () => {
    const { child, leader } = setActiveGroup(PlaybackState.IDLE);
    expect(requestGroupPlaybackConfirmation(leader, "remove", vi.fn())).toBe(
      false,
    );

    apiMock.queues[leader.player_id].state = PlaybackState.PLAYING;
    child.available = false;
    expect(requestGroupPlaybackConfirmation(leader, "remove", vi.fn())).toBe(
      false,
    );

    child.available = true;
    leader.synced_to = "other";
    expect(requestGroupPlaybackConfirmation(leader, "remove", vi.fn())).toBe(
      false,
    );

    leader.synced_to = null;
    leader.type = PlayerType.GROUP;
    expect(requestGroupPlaybackConfirmation(leader, "remove", vi.fn())).toBe(
      false,
    );
  });

  it("follows the leader reported by the server", async () => {
    const { child, leader } = setActiveGroup();
    const keepPlaying = vi.fn();
    storeMock.activePlayerId = leader.player_id;
    requestGroupPlaybackConfirmation(leader, "remove", keepPlaying);

    await dialogEvent?.onKeepPlaying();
    expect(keepPlaying).toHaveBeenCalledOnce();
    expect(storeMock.activePlayerId).toBe(leader.player_id);
    expect(apiMock.subscribe_multi).toHaveBeenCalledWith(
      [EventType.PLAYER_UPDATED, EventType.QUEUE_UPDATED],
      expect.any(Function),
    );

    child.synced_to = null;
    callbacks[0]();
    expect(storeMock.activePlayerId).toBe(leader.player_id);

    child.active_source = child.player_id;
    apiMock.queues[child.player_id] = playerQueue({
      queue_id: child.player_id,
      state: PlaybackState.PLAYING,
    });
    callbacks[0]();
    await Promise.resolve();

    expect(storeMock.activePlayerId).toBe(child.player_id);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("does not override a newer player selection", async () => {
    const { child, leader } = setActiveGroup();
    storeMock.activePlayerId = leader.player_id;
    requestGroupPlaybackConfirmation(leader, "remove", vi.fn());
    await dialogEvent?.onKeepPlaying();

    storeMock.activePlayerId = "bedroom";
    child.synced_to = null;
    callbacks[0]();
    await Promise.resolve();

    expect(storeMock.activePlayerId).toBe("bedroom");
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("stops playback by removing every group member", async () => {
    const { leader } = setActiveGroup();
    requestGroupPlaybackConfirmation(leader, "remove", vi.fn());

    await dialogEvent?.onStopAndUngroup();

    expect(apiMock.playerCommandSetMembers).toHaveBeenCalledWith(
      leader.player_id,
      undefined,
      ["leader", "child"],
    );
    expect(apiMock.playerCommandPower).not.toHaveBeenCalled();
  });

  it("ungroups before powering off the leader", async () => {
    const { leader } = setActiveGroup();
    togglePlayerPower(leader);

    expect(dialogEvent?.change).toBe("power_off");
    expect(apiMock.playerCommandPower).not.toHaveBeenCalled();

    await dialogEvent?.onStopAndUngroup();

    expect(apiMock.playerCommandSetMembers).toHaveBeenCalledBefore(
      apiMock.playerCommandPower,
    );
    expect(apiMock.playerCommandPower).toHaveBeenCalledWith(
      leader.player_id,
      false,
    );
  });

  it("changes power directly when no playback transfer is possible", async () => {
    const { leader } = setActiveGroup(PlaybackState.IDLE);

    await togglePlayerPower(leader);
    expect(apiMock.playerCommandPower).toHaveBeenCalledWith(
      leader.player_id,
      false,
    );
    expect(dialogEvent).toBeUndefined();

    leader.powered = false;
    await togglePlayerPower(leader);
    expect(apiMock.playerCommandPower).toHaveBeenLastCalledWith(
      leader.player_id,
      true,
    );
  });
});
