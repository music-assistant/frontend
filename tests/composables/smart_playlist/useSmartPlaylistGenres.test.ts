import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Genre } from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { genre } from "../../fixtures/genre";

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

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getLibraryGenres: vi.fn<MusicAssistantApi["getLibraryGenres"]>(),
  },
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

import { useSmartPlaylistGenres } from "@/composables/smart-playlist/useSmartPlaylistGenres";

describe("useSmartPlaylistGenres", () => {
  beforeEach(() => {
    apiMock.getLibraryGenres.mockResolvedValue([
      genreFixture("9", "Synthwave"),
      genreFixture("2", "Rock"),
    ]);
  });

  it("loads the genre list on mount and exposes options", async () => {
    const { genres, genreOptions } = useSmartPlaylistGenres();
    // wait a microtask for onMounted's promise resolution
    await Promise.resolve();
    await Promise.resolve();
    expect(genres.value.length).toBe(2);
    expect(genreOptions.value).toEqual([
      { id: 9, name: "Synthwave", item: genreFixture("9", "Synthwave") },
      { id: 2, name: "Rock", item: genreFixture("2", "Rock") },
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

function genreFixture(item_id: string, name: string): Genre {
  return genre({ item_id, name, uri: `library://genre/${item_id}` });
}
