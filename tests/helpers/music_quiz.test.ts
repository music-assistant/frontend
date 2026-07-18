import {
  clearStoredMusicQuizPlayerId,
  getStoredMusicQuizPlayerId,
  getStoredMusicQuizPlayerName,
  storeMusicQuizPlayerId,
  storeMusicQuizPlayerName,
} from "@/helpers/music_quiz";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Music Quiz guest name storage", () => {
  const storedValues = new Map<string, string>();

  beforeEach(() => {
    storedValues.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storedValues.get(key) ?? null,
      setItem: (key: string, value: string) => storedValues.set(key, value),
      removeItem: (key: string) => storedValues.delete(key),
    });
    vi.stubGlobal("sessionStorage", createStorage());
  });

  afterEach(() => vi.unstubAllGlobals());

  it("stores and returns a trimmed display name for the current tab", () => {
    storeMusicQuizPlayerName("  Player One  ", PARTICIPANT_CONTEXT);

    expect(getStoredMusicQuizPlayerName(PARTICIPANT_CONTEXT)).toBe(
      "Player One",
    );
    expect(
      JSON.parse(sessionStorage.getItem("music_quiz_player_name") || "{}"),
    ).toMatchObject({
      ...PARTICIPANT_CONTEXT,
      playerName: "Player One",
    });
    expect(localStorage.getItem("music_quiz_player_name")).toBeNull();
  });

  it("ignores blank display names", () => {
    storeMusicQuizPlayerName("   ", PARTICIPANT_CONTEXT);

    expect(getStoredMusicQuizPlayerName(PARTICIPANT_CONTEXT)).toBe("");
    expect(sessionStorage.getItem("music_quiz_player_name")).toBeNull();
  });

  it("discards a legacy shared display name", () => {
    localStorage.setItem("music_quiz_player_name", "Legacy Player");

    expect(getStoredMusicQuizPlayerName(PARTICIPANT_CONTEXT)).toBe("");
    expect(sessionStorage.getItem("music_quiz_player_name")).toBeNull();
    expect(localStorage.getItem("music_quiz_player_name")).toBeNull();
  });

  it("keeps the private player credential in the current tab across reloads", () => {
    storeMusicQuizPlayerId("private-player-id", PARTICIPANT_CONTEXT);

    expect(getStoredMusicQuizPlayerId(PARTICIPANT_CONTEXT)).toBe(
      "private-player-id",
    );
    expect(
      JSON.parse(sessionStorage.getItem("music_quiz_player_id") || "{}"),
    ).toMatchObject({
      ...PARTICIPANT_CONTEXT,
      playerId: "private-player-id",
    });
    expect(localStorage.getItem("music_quiz_player_id")).toBeNull();

    clearStoredMusicQuizPlayerId();
    expect(getStoredMusicQuizPlayerId(PARTICIPANT_CONTEXT)).toBeNull();
  });

  it("does not share participant state with another tab", () => {
    const firstTab = createStorage();
    const secondTab = createStorage();
    vi.stubGlobal("sessionStorage", firstTab);
    storeMusicQuizPlayerId("first-tab-player", PARTICIPANT_CONTEXT);
    storeMusicQuizPlayerName("First Tab", PARTICIPANT_CONTEXT);

    vi.stubGlobal("sessionStorage", secondTab);
    expect(getStoredMusicQuizPlayerId(PARTICIPANT_CONTEXT)).toBeNull();
    expect(getStoredMusicQuizPlayerName(PARTICIPANT_CONTEXT)).toBe("");

    vi.stubGlobal("sessionStorage", firstTab);
    expect(getStoredMusicQuizPlayerId(PARTICIPANT_CONTEXT)).toBe(
      "first-tab-player",
    );
    expect(getStoredMusicQuizPlayerName(PARTICIPANT_CONTEXT)).toBe("First Tab");
  });

  it("does not reuse participant state on another server", () => {
    storeMusicQuizPlayerId("private-player-id", PARTICIPANT_CONTEXT);
    storeMusicQuizPlayerName("Player", PARTICIPANT_CONTEXT);
    const otherServerContext = {
      ...PARTICIPANT_CONTEXT,
      connectionIdentity: "local:http://other-server:8095" as const,
    };

    expect(getStoredMusicQuizPlayerId(otherServerContext)).toBeNull();
    expect(getStoredMusicQuizPlayerName(otherServerContext)).toBe("");
  });

  it("discards a legacy shared player credential", () => {
    localStorage.setItem("music_quiz_player_id", "shared-player-id");

    expect(getStoredMusicQuizPlayerId(PARTICIPANT_CONTEXT)).toBeNull();
    expect(localStorage.getItem("music_quiz_player_id")).toBeNull();
  });

  const PARTICIPANT_CONTEXT = {
    connectionIdentity: "local:http://music-assistant:8095",
    participantIdentity: "regular-user",
  } as const;
});

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}
