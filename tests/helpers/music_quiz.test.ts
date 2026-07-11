import {
  getStoredMusicQuizPlayerName,
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
  });

  afterEach(() => vi.unstubAllGlobals());

  it("stores and returns a trimmed display name", () => {
    storeMusicQuizPlayerName("  Player One  ");

    expect(getStoredMusicQuizPlayerName()).toBe("Player One");
    expect(localStorage.getItem("music_quiz_player_name")).toBe("Player One");
  });

  it("ignores blank display names", () => {
    storeMusicQuizPlayerName("   ");

    expect(getStoredMusicQuizPlayerName()).toBe("");
    expect(localStorage.getItem("music_quiz_player_name")).toBeNull();
  });
});
