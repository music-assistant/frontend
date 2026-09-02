import {
  getDashboardViewerNavigationRedirect,
  restoreStrayViewerParams,
  sanitizeDashboardViewerPath,
} from "@/helpers/dashboard_viewer_access";
import { describe, expect, it } from "vitest";

describe("dashboard viewer dashboard path", () => {
  it.each(["/party", "/music-quiz", "/music-quiz/dashboard", "/now-playing"])(
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

  it("keeps the host route allowed for viewers pinned there by an older server", () => {
    expect(sanitizeDashboardViewerPath("/music-quiz")).toBe("/music-quiz");
  });
});

describe("stranded viewer route params", () => {
  it("restores a param a double-decoding client flattened out of the path", () => {
    expect(
      restoreStrayViewerParams(
        "/now-playing?player=abc",
        "?dashboard=CODE&path=/now-playing?player=abc&dashboard_id=kiosk1",
      ),
    ).toBe("/now-playing?player=abc&dashboard_id=kiosk1");
  });

  it("restores every stranded param, not just the first", () => {
    expect(
      restoreStrayViewerParams(
        "/now-playing",
        "?dashboard=CODE&path=/now-playing&player=abc&dashboard_id=kiosk1",
      ),
    ).toBe("/now-playing?player=abc&dashboard_id=kiosk1");
  });

  it("leaves an intact url untouched", () => {
    const path = "/now-playing?player=abc&dashboard_id=kiosk1";
    expect(restoreStrayViewerParams(path, "?dashboard=CODE&path=..")).toBe(
      path,
    );
  });

  it("never overrides a param the route already carries", () => {
    expect(
      restoreStrayViewerParams(
        "/now-playing?player=abc",
        "?player=stale&dashboard_id=kiosk1",
      ),
    ).toBe("/now-playing?player=abc&dashboard_id=kiosk1");
  });

  it("ignores query params that are not viewer route params", () => {
    expect(
      restoreStrayViewerParams("/party", "?dashboard=CODE&remote_id=xyz"),
    ).toBe("/party");
  });

  it("encodes a restored value", () => {
    expect(restoreStrayViewerParams("/party", "?dashboard_id=a b/c")).toBe(
      "/party?dashboard_id=a%20b%2Fc",
    );
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
