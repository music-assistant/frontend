import { describe, expect, it } from "vitest";
import {
  canonicalizeLocale,
  getLocaleDisplayName,
  resolveLocale,
} from "@/plugins/i18n";

// Mirrors the real translation filenames (POSIX `ll_CC` convention, as shipped by Lokalise).
const AVAILABLE = [
  "en",
  "en_AU",
  "en_GB",
  "zh_CN",
  "pt_BR",
  "pt_PT",
  "sr",
  "sr_Latn",
  "fr",
  "es",
];

describe("resolveLocale", () => {
  it("matches an exact POSIX key", () => {
    expect(resolveLocale("en_AU", AVAILABLE)).toBe("en_AU");
  });

  it("matches a BCP-47 (hyphen) input against a POSIX file", () => {
    expect(resolveLocale("en-AU", AVAILABLE)).toBe("en_AU");
    expect(resolveLocale("zh-CN", AVAILABLE)).toBe("zh_CN");
  });

  it("is case-insensitive and returns the real filename casing", () => {
    expect(resolveLocale("EN-au", AVAILABLE)).toBe("en_AU");
    expect(resolveLocale("zh_cn", AVAILABLE)).toBe("zh_CN");
  });

  it("falls back down the subtag chain to the base language", () => {
    // No `zh_TW` file → should not match Simplified, falls through to English.
    expect(resolveLocale("zh-TW", AVAILABLE)).toBe("en");
    // No `en_US` file, but `en` exists → base-language match.
    expect(resolveLocale("en-US", AVAILABLE)).toBe("en");
  });

  it("walks an intermediate subtag before the base language", () => {
    // "zh-Hans-CN" → "zh-hans-cn" (miss) → "zh-hans" (miss) → "zh" (miss) → "en".
    expect(resolveLocale("zh-Hans-CN", AVAILABLE)).toBe("en");
    // "sr-Latn-RS" → "sr-latn-rs" (miss) → "sr-latn" → matches `sr_Latn`.
    expect(resolveLocale("sr-Latn-RS", AVAILABLE)).toBe("sr_Latn");
  });

  it("handles a numeric (UN M49) region subtag", () => {
    // "es-419" → "es-419" (miss) → "es" → matches `es`. A letters-only regex would choke here.
    expect(resolveLocale("es-419", AVAILABLE)).toBe("es");
  });

  it("returns the base language when only it is shipped", () => {
    expect(resolveLocale("fr-CA", AVAILABLE)).toBe("fr");
  });

  it("falls back to English for an unknown language", () => {
    expect(resolveLocale("ja", AVAILABLE)).toBe("en");
    expect(resolveLocale("xx-YY", AVAILABLE)).toBe("en");
  });
});

describe("locale presentation", () => {
  it("canonicalizes underscore, script, and region subtags", () => {
    expect(canonicalizeLocale("pt_BR")).toBe("pt-BR");
    expect(canonicalizeLocale("sr_Latn_RS")).toBe("sr-Latn-RS");
    expect(canonicalizeLocale("es_419")).toBe("es-419");
  });

  it("uses friendly localized names with script and region distinctions", () => {
    expect(getLocaleDisplayName("pt_BR", "en")).toBe("Brazilian Portuguese");
    expect(getLocaleDisplayName("sr_Latn", "en")).toBe("Serbian (Latin)");
    expect(getLocaleDisplayName("en_AU", "de")).toBe("Englisch (Australien)");
  });

  it("falls back safely to the normalized code", () => {
    expect(getLocaleDisplayName("invalid_locale!", "en")).toBe(
      "invalid-locale!",
    );
  });
});
