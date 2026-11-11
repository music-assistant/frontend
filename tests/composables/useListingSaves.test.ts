import { useListingSaves } from "@/composables/useListingSaves";
import { flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { writePreference } = vi.hoisted(() => ({ writePreference: vi.fn() }));

vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    setItemsListingPreference: writePreference,
    setItemsListingPreferences: vi.fn(),
  }),
}));

function heldSave() {
  let finish!: () => void;
  writePreference.mockImplementationOnce(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  return () => finish();
}

describe("useListingSaves", () => {
  it("lets a restore through while nothing is being saved", () => {
    const onSettled = vi.fn();
    const { holdRestore } = useListingSaves(onSettled);

    expect(holdRestore()).toBe(false);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("holds a restore until the last save settles, then catches up once", async () => {
    const onSettled = vi.fn();
    const saves = useListingSaves(onSettled);
    const finishFirst = heldSave();
    const finishSecond = heldSave();

    void saves.setItemsListingPreference(
      "p",
      "artists",
      "favoriteFilter",
      true,
    );
    void saves.setItemsListingPreference("p", "artists", "sortBy", "name");
    expect(saves.holdRestore()).toBe(true);

    finishFirst();
    await flushPromises();
    expect(onSettled).not.toHaveBeenCalled();

    finishSecond();
    await flushPromises();
    expect(onSettled).toHaveBeenCalledOnce();
  });

  it("has nothing to catch up on when no restore was held", async () => {
    const onSettled = vi.fn();
    const saves = useListingSaves(onSettled);
    const finish = heldSave();

    void saves.setItemsListingPreference("p", "artists", "viewMode", "list");
    finish();
    await flushPromises();

    expect(onSettled).not.toHaveBeenCalled();
  });
});
