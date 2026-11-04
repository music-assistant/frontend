import { describe, expect, it } from "vitest";
import { useResolvingItems } from "./useResolvingItems";

describe("useResolvingItems", () => {
  const { isResolving, markResolving } = useResolvingItems();

  it("marks an item as resolving until its task resolves", async () => {
    let finish!: (value: string) => void;
    const task = markResolving(
      "musicbrainz://album/rg-1",
      new Promise<string>((resolve) => (finish = resolve)),
    );

    expect(isResolving("musicbrainz://album/rg-1")).toBe(true);
    expect(isResolving("musicbrainz://album/rg-2")).toBe(false);

    finish("done");
    await expect(task).resolves.toBe("done");
    expect(isResolving("musicbrainz://album/rg-1")).toBe(false);
  });

  it("clears the mark and passes the failure on when its task rejects", async () => {
    const failure = new Error("not found");
    const task = markResolving(
      "musicbrainz://album/rg-3",
      Promise.reject(failure),
    );

    expect(isResolving("musicbrainz://album/rg-3")).toBe(true);
    await expect(task).rejects.toBe(failure);
    expect(isResolving("musicbrainz://album/rg-3")).toBe(false);
  });
});
