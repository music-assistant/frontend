import { describe, expect, it } from "vitest";
import { lastLockedIndex } from "./queue_locked_index";
import { playerQueue } from "../../tests/fixtures/playerQueue";

describe("lastLockedIndex", () => {
  it("reads the index the server sends", () => {
    expect(
      lastLockedIndex(
        playerQueue({ extra_attributes: { last_locked_index: 4 } }),
      ),
    ).toBe(4);
  });

  it("is null when the server sends none", () => {
    expect(lastLockedIndex(playerQueue())).toBeNull();
  });
});
