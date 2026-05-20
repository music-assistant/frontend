import { describe, expect, it } from "vitest";
import { useSmartPlaylistYearRange } from "@/composables/useSmartPlaylistYearRange";

describe("useSmartPlaylistYearRange", () => {
  it("parses valid year input values", () => {
    const yearRange = useSmartPlaylistYearRange();

    yearRange.yearFromEl.value = { value: "1999" } as HTMLInputElement;
    yearRange.yearToEl.value = { value: " 2024 " } as HTMLInputElement;

    expect(yearRange.onYearFromInput()).toBe(1999);
    expect(yearRange.onYearToInput()).toBe(2024);
  });

  it("returns undefined for empty or invalid values", () => {
    const yearRange = useSmartPlaylistYearRange();

    yearRange.yearFromEl.value = { value: "" } as HTMLInputElement;
    yearRange.yearToEl.value = { value: "abc" } as HTMLInputElement;

    expect(yearRange.getYearFromInput()).toBeUndefined();
    expect(yearRange.getYearToInput()).toBeUndefined();
  });

  it("clears both inputs", () => {
    const yearRange = useSmartPlaylistYearRange();

    yearRange.yearFromEl.value = { value: "2001" } as HTMLInputElement;
    yearRange.yearToEl.value = { value: "2002" } as HTMLInputElement;

    yearRange.clearYear();

    expect(yearRange.yearFromEl.value?.value).toBe("");
    expect(yearRange.yearToEl.value?.value).toBe("");
  });
});
