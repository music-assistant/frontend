import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
  };
});

vi.mock("@/plugins/api", () => ({
  default: {
    getLibraryGenres: vi.fn().mockResolvedValue([]),
  },
}));

import { useSmartPlaylistGenres } from "@/composables/useSmartPlaylistGenres";

describe("useSmartPlaylistGenres", () => {
  it("moves genre from excluded to included on toggle", () => {
    const genreIds = ref<number[] | undefined>([]);
    const excludedGenreIds = ref<number[] | undefined>([2]);
    const genreNames = ref<Record<number, string> | undefined>({ 2: "Rock" });

    const genres = useSmartPlaylistGenres(
      genreIds,
      excludedGenreIds,
      genreNames,
    );

    genres.toggleGenreById(2);

    expect(genreIds.value).toEqual([2]);
    expect(excludedGenreIds.value).toEqual([]);
  });

  it("moves genre from included to excluded on excluded toggle", () => {
    const genreIds = ref<number[] | undefined>([5]);
    const excludedGenreIds = ref<number[] | undefined>([]);
    const genreNames = ref<Record<number, string> | undefined>();

    const genres = useSmartPlaylistGenres(
      genreIds,
      excludedGenreIds,
      genreNames,
    );

    genres.toggleExcludedGenreById(5);

    expect(genreIds.value).toEqual([]);
    expect(excludedGenreIds.value).toEqual([5]);
  });

  it("resolves genre name from ruleGenreNames fallback", () => {
    const genreIds = ref<number[] | undefined>([]);
    const excludedGenreIds = ref<number[] | undefined>([]);
    const genreNames = ref<Record<number, string> | undefined>({
      9: "Synthwave",
    });

    const genres = useSmartPlaylistGenres(
      genreIds,
      excludedGenreIds,
      genreNames,
    );

    expect(genres.genreName(9)).toBe("Synthwave");
    expect(genres.genreName(99)).toBe("99");
  });
});
