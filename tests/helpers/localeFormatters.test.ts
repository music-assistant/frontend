import { describe, expect, it } from "vitest";
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

  it("formats a name list under en_GB", () => {
    const label = withLocale("en_GB", () => formatNameList(["Ann", "Bo"]));

    expect(label).toContain("Ann");
    expect(label).toContain("Bo");
  });
});
