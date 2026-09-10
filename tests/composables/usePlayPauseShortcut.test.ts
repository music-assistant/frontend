import { usePlayPauseShortcut } from "@/composables/usePlayPauseShortcut";
import api from "@/plugins/api";
import {
  MediaType,
  PlaybackState,
  type Player,
  type PlayerQueue,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";

vi.mock("@/plugins/api", () => {
  const api = { playerCommandPlayPause: vi.fn(), playerCommandStop: vi.fn() };
  return { api, default: api };
});

const state = vi.hoisted(() => ({
  storeMock: {
    dialogActive: false,
    showPlayersMenu: false,
    activePlayer: undefined as Player | undefined,
    activePlayerQueue: undefined as PlayerQueue | undefined,
  },
}));

vi.mock("@/plugins/store", () => ({ store: state.storeMock }));

const playerCommandPlayPause = vi.mocked(api.playerCommandPlayPause);
const playerCommandStop = vi.mocked(api.playerCommandStop);

function player(overrides: Record<string, unknown> = {}): Player {
  return {
    player_id: "player-1",
    active_source: null,
    source_list: [],
    playback_state: PlaybackState.PLAYING,
    current_media: { media_type: MediaType.TRACK },
    ...overrides,
  } as unknown as Player;
}

function space(target?: HTMLElement) {
  const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
  (target ?? window).dispatchEvent(event);
}

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  state.storeMock.dialogActive = false;
  state.storeMock.showPlayersMenu = false;
  state.storeMock.activePlayer = undefined;
  state.storeMock.activePlayerQueue = undefined;
});

function mountShortcut() {
  return mount({
    setup: () => {
      usePlayPauseShortcut();
      return () => null;
    },
  });
}

describe("usePlayPauseShortcut", () => {
  it("pauses the active player on Space", () => {
    state.storeMock.activePlayer = player({
      playback_state: PlaybackState.PLAYING,
    });
    mountShortcut();

    space();

    expect(playerCommandPlayPause).toHaveBeenCalledWith("player-1");
    expect(playerCommandStop).not.toHaveBeenCalled();
  });

  it("stops instead of pausing a radio stream", () => {
    state.storeMock.activePlayer = player({
      playback_state: PlaybackState.PLAYING,
      current_media: { media_type: MediaType.RADIO },
    });
    mountShortcut();

    space();

    expect(playerCommandStop).toHaveBeenCalledWith("player-1");
    expect(playerCommandPlayPause).not.toHaveBeenCalled();
  });

  it("ignores Space typed into a text field", () => {
    state.storeMock.activePlayer = player();
    mountShortcut();
    const input = document.createElement("input");
    document.body.appendChild(input);

    space(input);

    expect(playerCommandPlayPause).not.toHaveBeenCalled();
    input.remove();
  });

  // the control activates itself on Space, so acting here too would toggle twice
  it("leaves Space to a focused control", () => {
    state.storeMock.activePlayer = player();
    mountShortcut();
    const button = document.createElement("div");
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    document.body.appendChild(button);

    space(button);

    expect(playerCommandPlayPause).not.toHaveBeenCalled();
    button.remove();
  });

  it("ignores Space while a play action is still in flight", () => {
    state.storeMock.activePlayer = player();
    // otherwise playable, so the in-flight flag is the only thing stopping it
    state.storeMock.activePlayerQueue = playerQueue({
      items: 1,
      extra_attributes: { play_action_in_progress: true },
    });
    mountShortcut();

    space();

    expect(playerCommandPlayPause).not.toHaveBeenCalled();
  });

  it("ignores Space while a dialog is open", () => {
    state.storeMock.activePlayer = player();
    state.storeMock.dialogActive = true;
    mountShortcut();

    space();

    expect(playerCommandPlayPause).not.toHaveBeenCalled();
  });

  it("does nothing without an active player", () => {
    mountShortcut();

    space();

    expect(playerCommandPlayPause).not.toHaveBeenCalled();
    expect(playerCommandStop).not.toHaveBeenCalled();
  });
});
