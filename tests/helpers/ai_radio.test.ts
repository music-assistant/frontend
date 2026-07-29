import {
  asGeneralDefaults,
  compileShow,
  decompileStation,
  errorMessage,
  relativeTimeFromIso,
  slugify,
} from "@/helpers/ai_radio";
import type { ShowDraft } from "@/helpers/ai_radio";
import type { AIRadioSection, AIRadioStation } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale.replaceAll("_", "-"),
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

const makeSection = (
  overrides: Partial<AIRadioSection> = {},
): AIRadioSection => ({
  id: "intro",
  name: "Intro",
  type: "ai_text",
  prompt: "Say hello",
  ...overrides,
});

const makeDraft = (
  overrides: Partial<ShowDraft["basics"]> = {},
): ShowDraft => ({
  basics: {
    name: "My Show",
    sourcePlaylistId: "42",
    sourcePlaylistProvider: "library",
    targetPlaylistProvider: "builtin",
    defaultPlayerId: "",
    maxDurationMinutes: 0,
    shuffleSourceTracks: true,
    dynamicBatchSize: 3,
    dynamicPollSeconds: 5,
    dynamicPrefetchRemainingTracks: 2,
    general: asGeneralDefaults(undefined),
    ...overrides,
  },
  segments: [],
});

const makeStation = (
  overrides: Partial<AIRadioStation> = {},
): AIRadioStation => ({
  id: "my_station",
  name: "My Station",
  source_playlist_id: "42",
  source_playlist_provider: "library",
  section_ids: ["intro"],
  section_order: [{ when: "between_songs", flow: [{ MUST: "intro" }] }],
  ...overrides,
});

describe("slugify", () => {
  it("normalizes names to snake_case ids", () => {
    expect(slugify("My Cool Station!")).toBe("my_cool_station");
    expect(slugify("  Frühstücks-Radio  ")).toBe("fr_hst_cks_radio");
  });

  it("falls back to a placeholder for empty input", () => {
    expect(slugify("!!!")).toBe("item");
  });
});

describe("errorMessage", () => {
  it("extracts messages from various error shapes", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage({ detail: "not found" })).toBe("not found");
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage({ code: 42 })).toBe('{"code":42}');
  });
});

describe("relativeTimeFromIso", () => {
  const NOW = Date.parse("2026-07-16T12:00:00Z");
  const at = (iso: string) => relativeTimeFromIso(iso, NOW);

  it("returns empty for missing or invalid input", () => {
    expect(relativeTimeFromIso(undefined, NOW)).toBe("");
    expect(relativeTimeFromIso("not-a-date", NOW)).toBe("");
  });

  it("formats sub-minute differences as now", () => {
    expect(at("2026-07-16T11:59:30Z")).toBe("now");
  });

  it("formats minutes, hours and days ago", () => {
    expect(at("2026-07-16T11:45:00Z")).toBe("15m ago");
    expect(at("2026-07-16T10:00:00Z")).toBe("2h ago");
    expect(at("2026-07-13T12:00:00Z")).toBe("3d ago");
  });
});

describe("compileShow", () => {
  it("writes shuffle_source_tracks from the draft", () => {
    const draft = makeDraft({ shuffleSourceTracks: false });
    expect(compileShow(draft).shuffle_source_tracks).toBe(false);
  });
});

describe("decompileStation", () => {
  it("defaults shuffleSourceTracks to true when absent from the station", () => {
    const { basics } = decompileStation(makeStation(), [makeSection()]);
    expect(basics.shuffleSourceTracks).toBe(true);
  });
});
