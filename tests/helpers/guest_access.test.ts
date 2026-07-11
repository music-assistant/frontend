import {
  getGuestNavigationRedirect,
  isGuestAccessAllowedRoute,
} from "@/helpers/guest_access";
import { describe, expect, it } from "vitest";

describe("guest access routing", () => {
  it.each(["/guest", "/guest/party", "/guest/quiz", "/music-quiz/play"])(
    "allows guest route %s",
    (path) => {
      expect(isGuestAccessAllowedRoute(path)).toBe(true);
      expect(getGuestNavigationRedirect(true, path)).toBeUndefined();
    },
  );

  it.each(["party_guest", "music_quiz_guest"])(
    "confines a %s token to the unified guest entry",
    () => {
      expect(getGuestNavigationRedirect(true, "/discover")).toBe("/guest");
    },
  );

  it("does not redirect normal users", () => {
    expect(getGuestNavigationRedirect(false, "/discover")).toBeUndefined();
  });
});
