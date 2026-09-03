import { prioritizeSelectedPlayer } from "@/components/discover/utils/playerShelf";
import { describe, expect, it } from "vitest";

const players = [
  { player_id: "attic" },
  { player_id: "kitchen" },
  { player_id: "office" },
];

describe("prioritizeSelectedPlayer", () => {
  it("moves the selected player ahead of the existing order", () => {
    expect(prioritizeSelectedPlayer(players, "office")).toEqual([
      { player_id: "office" },
      { player_id: "attic" },
      { player_id: "kitchen" },
    ]);
  });

  it("preserves the existing order without a visible selection", () => {
    expect(prioritizeSelectedPlayer(players)).toBe(players);
    expect(prioritizeSelectedPlayer(players, "unavailable")).toBe(players);
  });

  it("does not rebuild the list when the selected player is already first", () => {
    expect(prioritizeSelectedPlayer(players, "attic")).toBe(players);
  });
});
