import { describe, expect, it, vi } from "vitest";

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (k: string) => k, te: () => false }),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    getLibraryGenres: vi.fn().mockResolvedValue([
      { item_id: "9", name: "Synthwave" },
      { item_id: "2", name: "Rock" },
    ]),
  },
}));

import { useSmartPlaylistGenres } from "@/composables/useSmartPlaylistGenres";

describe("useSmartPlaylistGenres", () => {
  it("loads the genre list on mount and exposes options", async () => {
    const { genres, genreOptions } = useSmartPlaylistGenres();
    // wait a microtask for onMounted's promise resolution
    await Promise.resolve();
    await Promise.resolve();
    expect(genres.value.length).toBe(2);
    expect(genreOptions.value).toEqual([
      {
        id: 9,
        name: "Synthwave",
        item: { item_id: "9", name: "Synthwave" },
      },
      { id: 2, name: "Rock", item: { item_id: "2", name: "Rock" } },
    ]);
  });

  it("resolves genre name from loaded list, then fallback, then stringified id", async () => {
    const { genreName } = useSmartPlaylistGenres();
    await Promise.resolve();
    await Promise.resolve();
    expect(genreName(9)).toBe("Synthwave");
    expect(genreName(99, "Lost Genre")).toBe("Lost Genre");
    expect(genreName(42)).toBe("42");
  });
});
