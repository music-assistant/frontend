import { type MediaItemType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { track } from "../../tests/fixtures/track";
import {
  blockStartIndex,
  listsPlaylistFromStart,
  movedOrder,
  moveListedItems,
  playlistPosition,
} from "./playlist_reorder";

const listing = (count: number): MediaItemType[] =>
  Array.from({ length: count }, (_, index) =>
    track({ item_id: `t${index + 1}`, position: index + 1 }),
  );

const ids = (items: MediaItemType[]) => items.map((item) => item.item_id);
const positions = (items: MediaItemType[]) => items.map(playlistPosition);

describe("moveListedItems", () => {
  it("moves a single item down and up", () => {
    expect(ids(moveListedItems(listing(5), [1], 3))).toEqual([
      "t1",
      "t3",
      "t4",
      "t2",
      "t5",
    ]);
    expect(ids(moveListedItems(listing(5), [3], 1))).toEqual([
      "t1",
      "t4",
      "t2",
      "t3",
      "t5",
    ]);
  });

  it("moves a block, keeping its order", () => {
    const moved = moveListedItems(listing(5), [1, 2], 3);

    expect(ids(moved)).toEqual(["t1", "t4", "t5", "t2", "t3"]);
    expect(positions(moved)).toEqual([1, 2, 3, 4, 5]);
  });

  it("gathers scattered items into one block", () => {
    expect(ids(moveListedItems(listing(5), [4, 0, 2], 0))).toEqual([
      "t1",
      "t3",
      "t5",
      "t2",
      "t4",
    ]);
  });

  it("moves to the top and to the bottom", () => {
    expect(ids(moveListedItems(listing(4), [2, 3], 0))).toEqual([
      "t3",
      "t4",
      "t1",
      "t2",
    ]);
    expect(ids(moveListedItems(listing(4), [0, 1], 2))).toEqual([
      "t3",
      "t4",
      "t1",
      "t2",
    ]);
  });

  it("leaves the original listing and the items that keep their slot untouched", () => {
    const items = listing(5);
    const moved = moveListedItems(items, [1], 2);

    expect(ids(items)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    expect(positions(items)).toEqual([1, 2, 3, 4, 5]);
    expect(moved[0]).toBe(items[0]);
    expect(moved[4]).toBe(items[4]);
  });
});

describe("blockStartIndex", () => {
  it("is the drop row when no block row sits above it", () => {
    expect(blockStartIndex([4, 5], 1)).toBe(1);
  });

  it("subtracts the block rows above the drop row", () => {
    expect(blockStartIndex([1, 2], 5)).toBe(3);
    expect(blockStartIndex([0, 3, 6], 5)).toBe(3);
  });
});

describe("playlistPosition", () => {
  it("reads the position of a playlist item", () => {
    expect(playlistPosition(track({ position: 4 }))).toBe(4);
  });

  it("is undefined for an item without one", () => {
    expect(playlistPosition(track())).toBeUndefined();
  });
});

describe("listsPlaylistFromStart", () => {
  it("holds for the playlist's first rows in order", () => {
    expect(listsPlaylistFromStart(listing(3))).toBe(true);
    expect(listsPlaylistFromStart([])).toBe(true);
  });

  it("fails when rows are left out or out of order", () => {
    const items = listing(5);
    expect(listsPlaylistFromStart([items[3], items[4]])).toBe(false);
    expect(listsPlaylistFromStart([items[1], items[0]])).toBe(false);
  });
});

describe("movedOrder", () => {
  it("gives the row each row was before the move", () => {
    expect(movedOrder(5, [1, 3], 0)).toEqual([1, 3, 0, 2, 4]);
    expect(movedOrder(4, [0], 3)).toEqual([1, 2, 3, 0]);
  });
});
