import { describe, expect, it } from "vitest";
import {
  discographyTypesSummary,
  validDiscographyTypes,
  withDiscographyTypeToggled,
} from "./discography_types";
import { AlbumType } from "../plugins/api/interfaces";

describe("validDiscographyTypes", () => {
  it("keeps the offered types once each, in offered order", () => {
    expect(
      validDiscographyTypes([
        AlbumType.LIVE,
        AlbumType.ALBUM,
        AlbumType.LIVE,
        AlbumType.EP,
      ]),
    ).toEqual([AlbumType.ALBUM, AlbumType.EP, AlbumType.LIVE]);
  });

  it("drops the unknown type and anything that is no type", () => {
    expect(
      validDiscographyTypes([AlbumType.UNKNOWN, "bogus", 3, AlbumType.SINGLE]),
    ).toEqual([AlbumType.SINGLE]);
  });

  it.each([undefined, null, "album", { album: true }])(
    "reads %s as no types",
    (value) => {
      expect(validDiscographyTypes(value)).toEqual([]);
    },
  );
});

describe("withDiscographyTypeToggled", () => {
  it("ticks a type in offered order", () => {
    expect(
      withDiscographyTypeToggled([AlbumType.LIVE], AlbumType.ALBUM),
    ).toEqual([AlbumType.ALBUM, AlbumType.LIVE]);
  });

  it("unticks a type", () => {
    expect(
      withDiscographyTypeToggled(
        [AlbumType.ALBUM, AlbumType.LIVE],
        AlbumType.ALBUM,
      ),
    ).toEqual([AlbumType.LIVE]);
  });

  it("keeps the last ticked type", () => {
    expect(
      withDiscographyTypeToggled([AlbumType.ALBUM], AlbumType.ALBUM),
    ).toEqual([AlbumType.ALBUM]);
  });
});

describe("discographyTypesSummary", () => {
  const label = (type: AlbumType) => `${type}s`;

  it("names a single type", () => {
    expect(discographyTypesSummary([AlbumType.ALBUM], label)).toBe("albums");
  });

  it("names the first type and counts the others", () => {
    expect(
      discographyTypesSummary(
        [AlbumType.ALBUM, AlbumType.EP, AlbumType.LIVE],
        label,
      ),
    ).toBe("albums +2");
  });

  it("is empty without types", () => {
    expect(discographyTypesSummary([], label)).toBe("");
  });
});
