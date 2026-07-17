import {
  getCastViewerNavigationRedirect,
  sanitizeCastViewerPath,
} from "@/helpers/cast_viewer_access";
import { describe, expect, it } from "vitest";

describe("cast viewer dashboard path", () => {
  it.each(["/party", "/music-quiz"])(
    "keeps a known dashboard route %s",
    (path) => {
      expect(sanitizeCastViewerPath(path)).toBe(path);
    },
  );

  it.each([null, "", "/discover", "/settings"])(
    "falls back to /party for %s",
    (path) => {
      expect(sanitizeCastViewerPath(path)).toBe("/party");
    },
  );
});

describe("cast viewer navigation guard", () => {
  it("pins a cast viewer to its dashboard route", () => {
    expect(getCastViewerNavigationRedirect(true, "/party", "/discover")).toBe(
      "/party",
    );
  });

  it("does not redirect within the pinned route", () => {
    expect(
      getCastViewerNavigationRedirect(true, "/party", "/party"),
    ).toBeUndefined();
  });

  it("does not redirect non-cast-viewer sessions", () => {
    expect(
      getCastViewerNavigationRedirect(false, "/party", "/discover"),
    ).toBeUndefined();
  });

  it("does not redirect when no pinned path is known", () => {
    expect(
      getCastViewerNavigationRedirect(true, null, "/discover"),
    ).toBeUndefined();
  });
});
