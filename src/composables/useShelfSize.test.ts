import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShelfSize } from "./useShelfSize";

const { store, isPhone, setPreference } = await vi.hoisted(async () => {
  const { reactive, ref } = await import("vue");
  return {
    store: reactive({
      currentUser: { preferences: {} as Record<string, unknown> },
    }),
    isPhone: ref(false),
    setPreference: vi.fn(),
  };
});

vi.mock("@/plugins/store", () => ({ store }));
vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: () => isPhone.value,
}));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: setPreference,
}));
// a window that fits five columns by default, a phone two
vi.mock("@/helpers/utils", () => ({
  panelViewItemResponsive: () => (isPhone.value ? 2 : 5),
}));

describe("useShelfSize", () => {
  beforeEach(() => {
    store.currentUser.preferences = {};
    isPhone.value = false;
    setPreference.mockReset();
    setPreference.mockImplementation(async (key: string, value: unknown) => {
      // the optimistic local update of the user preferences
      store.currentUser.preferences = {
        ...store.currentUser.preferences,
        [key]: value,
      };
    });
  });

  it.each([
    { phone: false, size: 0, tiles: 5.5 },
    { phone: false, size: -2, tiles: 7.5 },
    { phone: false, size: 2, tiles: 3.5 },
    { phone: true, size: 0, tiles: 2.2 },
    { phone: true, size: -2, tiles: 4.2 },
    { phone: true, size: 2, tiles: 2.2 },
  ])(
    "fits the columns of a listing (phone: $phone, size: $size)",
    ({ phone, size, tiles }) => {
      isPhone.value = phone;
      store.currentUser.preferences = { "discover.gridSize": size };
      expect(useShelfSize().tilesPerView(0.5, 0.2)).toBeCloseTo(tiles);
    },
  );

  it("follows the slider, and keeps the size it is let go at", async () => {
    const shelf = useShelfSize();
    shelf.onChange(-2);
    expect(useShelfSize().size.value).toBe(-2);
    expect(setPreference).not.toHaveBeenCalled();
    void shelf.onCommit(1);
    await flushPromises();
    expect(setPreference).toHaveBeenCalledWith("discover.gridSize", 1);
    expect(shelf.size.value).toBe(1);
  });
});
