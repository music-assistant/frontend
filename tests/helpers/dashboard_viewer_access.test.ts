import {
  getDashboardViewerNavigationRedirect,
  sanitizeDashboardViewerPath,
} from "@/helpers/dashboard_viewer_access";
import { describe, expect, it } from "vitest";

describe("dashboard viewer dashboard path", () => {
  it.each(["/party", "/music-quiz", "/now-playing"])(
    "keeps a known dashboard route %s",
    (path) => {
      expect(sanitizeDashboardViewerPath(path)).toBe(path);
    },
  );

  it.each([null, "", "/discover", "/settings"])(
    "falls back to /party for %s",
    (path) => {
      expect(sanitizeDashboardViewerPath(path)).toBe("/party");
    },
  );

  it("keeps a known route's query string intact", () => {
    expect(sanitizeDashboardViewerPath("/now-playing?player=abc")).toBe(
      "/now-playing?player=abc",
    );
  });

  it("falls back to /party when the pathname isn't allowed, query string included", () => {
    expect(sanitizeDashboardViewerPath("/settings?tab=general")).toBe("/party");
  });
});

describe("dashboard viewer navigation guard", () => {
  it("pins a dashboard viewer to its dashboard route", () => {
    expect(
      getDashboardViewerNavigationRedirect(true, "/party", "/discover"),
    ).toBe("/party");
  });

  it("does not redirect within the pinned route", () => {
    expect(
      getDashboardViewerNavigationRedirect(true, "/party", "/party"),
    ).toBeUndefined();
  });

  it("does not redirect non-dashboard-viewer sessions", () => {
    expect(
      getDashboardViewerNavigationRedirect(false, "/party", "/discover"),
    ).toBeUndefined();
  });

  it("does not redirect when no pinned path is known", () => {
    expect(
      getDashboardViewerNavigationRedirect(true, null, "/discover"),
    ).toBeUndefined();
  });

  it("does not redirect within the pinned route when the query string matches", () => {
    expect(
      getDashboardViewerNavigationRedirect(
        true,
        "/now-playing?player=abc",
        "/now-playing?player=abc",
      ),
    ).toBeUndefined();
  });

  it("redirects back to the pinned route when the query string differs", () => {
    expect(
      getDashboardViewerNavigationRedirect(
        true,
        "/now-playing?player=abc",
        "/now-playing?player=xyz",
      ),
    ).toBe("/now-playing?player=abc");
  });
});
