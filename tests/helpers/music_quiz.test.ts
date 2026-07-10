import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

import {
  isMusicQuizPlayerNotFoundError,
  isNoActiveMusicQuizError,
} from "@/helpers/music_quiz";

describe("music quiz error helpers", () => {
  it("matches the no-active-game server message", () => {
    expect(
      isNoActiveMusicQuizError(new Error("There is no active Music Quiz game")),
    ).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isNoActiveMusicQuizError(new Error("temporary network error"))).toBe(
      false,
    );
  });

  it("does not match generic non-quiz 'no active' errors", () => {
    expect(
      isNoActiveMusicQuizError(new Error("No active output device selected")),
    ).toBe(false);
  });

  it("matches player-not-found errors", () => {
    expect(
      isMusicQuizPlayerNotFoundError(new Error("Music Quiz player not found")),
    ).toBe(true);
  });
});
