import { describe, expect, it } from "vitest";
import { shouldPrefetchAiRadio } from "./ai_radio_prefetch";

describe("shouldPrefetchAiRadio", () => {
  it("prefetches when the provider is available for a regular session", () => {
    expect(shouldPrefetchAiRadio(true, null)).toBe(true);
  });

  it.each(["party", "music_quiz", "dashboard"] as const)(
    "does not prefetch for a %s session",
    (guestSessionKind) => {
      expect(shouldPrefetchAiRadio(true, guestSessionKind)).toBe(false);
    },
  );

  it("does not prefetch when the provider is unavailable", () => {
    expect(shouldPrefetchAiRadio(false, null)).toBe(false);
  });
});
