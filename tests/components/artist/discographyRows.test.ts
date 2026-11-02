import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, mockUpdateUserPreferences } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockUpdateUserPreferences: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/composables/userPreferences", () => ({
  updateUserPreferences: mockUpdateUserPreferences,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, named?: { first: string; count: number }) =>
    named ? `${key}(${named.first},${named.count})` : key,
}));

import {
  DISCOGRAPHY_TYPES_PREFERENCE_KEY,
  discographyTypes,
  discographyTypesLabel,
  isDiscographyRow,
  setDiscographyTypes,
} from "@/components/artist/discographyRows";
import { AlbumType } from "@/plugins/api/interfaces";

function setPreferences(preferences: Record<string, unknown>) {
  storeMock.currentUser = { preferences };
}

describe("discographyTypes", () => {
  beforeEach(() => {
    storeMock.currentUser = null;
    mockUpdateUserPreferences.mockReset();
  });

  it("starts the first row on albums and the second on live releases", () => {
    expect(discographyTypes("discography")).toEqual([AlbumType.ALBUM]);
    expect(discographyTypes("discography_second")).toEqual([AlbumType.LIVE]);
  });

  it("follows the types saved for each row", () => {
    setPreferences({
      [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: {
        discography: [AlbumType.EP, AlbumType.SINGLE],
      },
    });

    expect(discographyTypes("discography")).toEqual([
      AlbumType.SINGLE,
      AlbumType.EP,
    ]);
    expect(discographyTypes("discography_second")).toEqual([AlbumType.LIVE]);
  });

  it.each([[[]], [[AlbumType.UNKNOWN]], ["album"]])(
    "falls back to the default for a saved %j",
    (saved) => {
      setPreferences({
        [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: { discography: saved },
      });

      expect(discographyTypes("discography")).toEqual([AlbumType.ALBUM]);
    },
  );

  it("saves a row's types next to the other row's", async () => {
    await setDiscographyTypes("discography_second", [
      AlbumType.LIVE,
      AlbumType.COMPILATION,
    ]);

    const [change] = mockUpdateUserPreferences.mock.lastCall!;
    expect(
      change({
        theme: "dark",
        [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: { discography: [AlbumType.EP] },
      }),
    ).toEqual({
      theme: "dark",
      [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: {
        discography: [AlbumType.EP],
        discography_second: [AlbumType.LIVE, AlbumType.COMPILATION],
      },
    });
  });

  it("tells the discography rows apart from the others", () => {
    expect(isDiscographyRow("discography")).toBe(true);
    expect(isDiscographyRow("discography_second")).toBe(true);
    expect(isDiscographyRow("albums")).toBe(false);
  });
});

describe("discographyTypesLabel", () => {
  it("names a single type", () => {
    expect(discographyTypesLabel([AlbumType.ALBUM])).toBe(
      "album_type_plural.album",
    );
  });

  it("names the first type and counts the others through the summary text", () => {
    expect(
      discographyTypesLabel([AlbumType.ALBUM, AlbumType.EP, AlbumType.LIVE]),
    ).toBe("discography_types_summary(album_type_plural.album,2)");
  });
});
