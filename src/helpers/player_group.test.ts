import { describe, expect, it } from "vitest";
import { isPlayerGroupFilter } from "./player_group";

describe("isPlayerGroupFilter", () => {
  it("accepts all players and each kind of player", () => {
    for (const value of [
      "all",
      "players",
      "lights",
      "screens",
      "inputs",
      "controllers",
    ]) {
      expect(isPlayerGroupFilter(value)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["group", "", undefined, null, 1]) {
      expect(isPlayerGroupFilter(value)).toBe(false);
    }
  });
});
