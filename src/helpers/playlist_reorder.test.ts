import { type MediaItemType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { track } from "../../tests/fixtures/track";
import { moveListedItem, playlistPosition } from "./playlist_reorder";

const listing = (count: number): MediaItemType[] =>
  Array.from({ length: count }, (_, index) =>
    track({ item_id: `t${index + 1}`, position: index + 1 }),
  );

const ids = (items: MediaItemType[]) => items.map((item) => item.item_id);
const positions = (items: MediaItemType[]) => items.map(playlistPosition);

describe("moveListedItem", () => {
  it("moves an item down", () => {
    const moved = moveListedItem(listing(5), 1, 3);

    expect(ids(moved)).toEqual(["t1", "t3", "t4", "t2", "t5"]);
    expect(positions(moved)).toEqual([1, 2, 3, 4, 5]);
  });

  it("moves an item up", () => {
    const moved = moveListedItem(listing(5), 3, 1);

    expect(ids(moved)).toEqual(["t1", "t4", "t2", "t3", "t5"]);
    expect(positions(moved)).toEqual([1, 2, 3, 4, 5]);
  });

  it("moves an item to the top and to the bottom", () => {
    expect(ids(moveListedItem(listing(3), 2, 0))).toEqual(["t3", "t1", "t2"]);
    expect(ids(moveListedItem(listing(3), 0, 2))).toEqual(["t2", "t3", "t1"]);
  });

  it("leaves the original listing and the items outside the move untouched", () => {
    const items = listing(5);
    const moved = moveListedItem(items, 1, 2);

    expect(ids(items)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    expect(positions(items)).toEqual([1, 2, 3, 4, 5]);
    expect(moved[0]).toBe(items[0]);
    expect(moved[4]).toBe(items[4]);
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
