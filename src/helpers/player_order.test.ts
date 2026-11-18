import { describe, expect, it } from "vitest";
import { keepPlayerOrder } from "./player_order";

const player = (player_id: string) => ({ player_id });
const ids = (players: { player_id: string }[]) =>
  players.map(({ player_id }) => player_id);

describe("keepPlayerOrder", () => {
  it("keeps the given order when the players move", () => {
    expect(
      ids(
        keepPlayerOrder(
          [player("c"), player("a"), player("b")],
          ["a", "b", "c"],
        ),
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("puts new players at the end in their own order", () => {
    expect(
      ids(
        keepPlayerOrder(
          [player("e"), player("b"), player("d"), player("a")],
          ["a", "b"],
        ),
      ),
    ).toEqual(["a", "b", "e", "d"]);
  });

  it("skips players that are gone", () => {
    expect(
      ids(keepPlayerOrder([player("c"), player("a")], ["a", "b", "c"])),
    ).toEqual(["a", "c"]);
  });

  it("keeps the given players as they are without an order", () => {
    expect(ids(keepPlayerOrder([player("b"), player("a")], []))).toEqual([
      "b",
      "a",
    ]);
  });
});
