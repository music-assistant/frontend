import { describe, expect, it } from "vitest";
import { relativeTimeFromIso } from "@/helpers/ai_radio";
import { formatNameList } from "@/helpers/music_quiz";
import { i18n } from "@/plugins/i18n";

/**
 * Lokalise locales use underscores (en_GB), which Intl rejects as an invalid
 * language tag. Thrown from a render function it takes the whole component out.
 */
describe("Intl formatters with an underscored locale", () => {
  const withLocale = <T>(locale: string, fn: () => T): T => {
    const previous = i18n.global.locale.value;
    i18n.global.locale.value = locale;
    try {
      return fn();
    } finally {
      i18n.global.locale.value = previous;
    }
  };

  it.each(["en_GB", "de_DE", "pt_BR"])(
    "formats a relative time under %s",
    (locale) => {
      const now = Date.parse("2026-07-29T12:00:00Z");
      const then = new Date(now - 2 * 3600 * 1000).toISOString();

      const label = withLocale(locale, () => relativeTimeFromIso(then, now));

      expect(label).not.toBe("");
    },
  );

  it("formats a name list under en_GB", () => {
    const label = withLocale("en_GB", () => formatNameList(["Ann", "Bo"]));

    expect(label).toContain("Ann");
    expect(label).toContain("Bo");
  });

  it("still formats a relative time under a hyphenated locale", () => {
    const now = Date.parse("2026-07-29T12:00:00Z");
    const then = new Date(now - 90 * 1000).toISOString();

    expect(withLocale("en-GB", () => relativeTimeFromIso(then, now))).not.toBe(
      "",
    );
  });
});
