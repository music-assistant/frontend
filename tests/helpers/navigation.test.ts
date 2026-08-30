import { backFromMediaDetails, canGoBack, goBack } from "@/helpers/navigation";
import type { Router } from "vue-router";
import { describe, expect, it, vi } from "vitest";

/** A router on `routeName`, reached from `backEntry` when one is given. */
function fakeRouter(routeName?: string, backEntry: string | null = null) {
  const back = vi.fn();
  const push = vi.fn();
  const router = {
    back,
    push,
    currentRoute: { value: { name: routeName } },
    options: { history: { state: { back: backEntry } } },
  } as unknown as Router;
  return { router, back, push };
}

describe("canGoBack", () => {
  it("is true while history holds an earlier entry", () => {
    expect(canGoBack(fakeRouter("album", "/albums").router)).toBe(true);
  });

  it("is false on a view opened directly", () => {
    expect(canGoBack(fakeRouter("album").router)).toBe(false);
  });
});

describe("goBack", () => {
  it("returns to the previous view when there is one", () => {
    const { router, back, push } = fakeRouter(
      "editplayer",
      "/settings/players",
    );

    goBack(router, { name: "playersettings" });

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("takes the fallback on a view opened directly", () => {
    const { router, back, push } = fakeRouter("editplayer");

    goBack(router, { name: "playersettings" });

    expect(push).toHaveBeenCalledWith({ name: "playersettings" });
    expect(back).not.toHaveBeenCalled();
  });
});

describe("backFromMediaDetails", () => {
  it("returns to the previous view when there is one", () => {
    const { router, back, push } = fakeRouter("album", "/albums");

    backFromMediaDetails(router);

    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ["album", "albums"],
    ["artist", "artists"],
    ["audiobook", "audiobooks"],
    ["collection", "audiobooks"],
    ["genre", "genres"],
    ["playlist", "playlists"],
    ["podcast", "podcasts"],
    ["radio", "radios"],
    ["track", "tracks"],
  ])("goes up from %s opened directly to %s", (details, listing) => {
    const { router, back, push } = fakeRouter(details);

    backFromMediaDetails(router);

    expect(push).toHaveBeenCalledWith({ name: listing });
    expect(back).not.toHaveBeenCalled();
  });

  it("falls back to discover for a route without a listing", () => {
    const { router, push } = fakeRouter("search");

    backFromMediaDetails(router);

    expect(push).toHaveBeenCalledWith({ name: "discover" });
  });

  it("falls back to discover for an unnamed route", () => {
    const { router, push } = fakeRouter(undefined);

    backFromMediaDetails(router);

    expect(push).toHaveBeenCalledWith({ name: "discover" });
  });
});
