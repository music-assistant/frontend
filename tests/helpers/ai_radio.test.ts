import {
  buildStationPayload,
  defaultGuidedPlacement,
  errorMessage,
  getFlowType,
  makeDefaultFlowItem,
  normalizeSectionDraft,
  normalizeStationDraft,
  parseOptionalCapInput,
  parseOptionalNumber,
  parseOptionalPositiveInt,
  playlistSelectValue,
  relativeTimeFromIso,
  safeInteger,
  safeNumber,
  showArtGradient,
  slugify,
  splitPlaylistSelectValue,
  validateStationDraftLocal,
} from "@/helpers/ai_radio";
import type { AIRadioSection, AIRadioStation } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
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

describe("number parsing", () => {
  it("clamps and falls back safely", () => {
    expect(safeNumber("5", 0, 1)).toBe(5);
    expect(safeNumber("-3", 0, 1)).toBe(0);
    expect(safeNumber("abc", 0, 1)).toBe(1);
    expect(safeInteger("7.9", 1, 1)).toBe(7);
    expect(safeInteger("abc", 1, 3)).toBe(3);
  });

  it("treats empty optional inputs as unset", () => {
    expect(parseOptionalNumber("")).toBe(0);
    expect(parseOptionalCapInput("")).toBeUndefined();
    expect(parseOptionalCapInput("-1")).toBeUndefined();
    expect(parseOptionalCapInput("90")).toBe(90);
    expect(parseOptionalPositiveInt("0")).toBeUndefined();
    expect(parseOptionalPositiveInt("4")).toBe(4);
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

describe("playlist select values", () => {
  it("round-trips provider and item id", () => {
    const value = playlistSelectValue("spotify", "abc:123");
    expect(splitPlaylistSelectValue(value)).toEqual({
      provider: "spotify",
      itemId: "abc:123",
    });
  });

  it("defaults to library provider for malformed values", () => {
    expect(splitPlaylistSelectValue("")).toEqual({
      provider: "library",
      itemId: "",
    });
  });
});

describe("normalizeSectionDraft", () => {
  it("applies defaults and coerces the type", () => {
    const draft = normalizeSectionDraft({
      id: " intro ",
      name: " Intro ",
      type: "bogus" as AIRadioSection["type"],
      prompt: "",
    } as AIRadioSection);
    expect(draft.id).toBe("intro");
    expect(draft.name).toBe("Intro");
    expect(draft.type).toBe("ai_text");
    expect(draft.web_search).toBe("disabled");
    expect(draft.constraints).toEqual({ max_chars: 0 });
  });
});

describe("normalizeStationDraft", () => {
  it("fills defaults for missing fields", () => {
    const draft = normalizeStationDraft({} as AIRadioStation);
    expect(draft.source_playlist_provider).toBe("library");
    expect(draft.target_playlist_provider).toBe("builtin");
    expect(draft.dynamic_batch_size).toBe(1);
    expect(draft.clear_queue_on_start).toBe(true);
    expect(draft.general.timezone).toBe("UTC");
    expect(draft.general.weather_provider).toBe("open_meteo");
    expect(draft.section_ids).toEqual([]);
  });

  it("keeps explicit values", () => {
    const draft = normalizeStationDraft(
      makeStation({ clear_queue_on_start: false, dynamic_batch_size: 3 }),
    );
    expect(draft.clear_queue_on_start).toBe(false);
    expect(draft.dynamic_batch_size).toBe(3);
  });
});

describe("buildStationPayload", () => {
  it("derives the id from the name and strips embedded sections", () => {
    const draft = normalizeStationDraft(
      makeStation({ id: "", name: "Morning Show" }),
    );
    draft.sections = [makeSection()];
    const payload = buildStationPayload(draft);
    expect(payload.id).toBe("morning_show");
    expect("sections" in payload).toBe(false);
  });
});

describe("validateStationDraftLocal", () => {
  it("accepts a complete station", () => {
    expect(validateStationDraftLocal(makeStation())).toBeNull();
  });

  it("rejects missing required fields", () => {
    expect(validateStationDraftLocal(makeStation({ name: " " }))).toContain(
      "station_name_required",
    );
    expect(
      validateStationDraftLocal(makeStation({ source_playlist_id: "" })),
    ).toContain("station_source_playlist_required");
    expect(
      validateStationDraftLocal(makeStation({ section_ids: [] })),
    ).toContain("select_section");
    expect(
      validateStationDraftLocal(makeStation({ section_order: [] })),
    ).toContain("section_order_required");
  });

  it("rejects incomplete flow items", () => {
    expect(
      validateStationDraftLocal(
        makeStation({
          section_order: [{ when: "between_songs", flow: [{ MUST: "" }] }],
        }),
      ),
    ).toContain("must_needs_section");
    expect(
      validateStationDraftLocal(
        makeStation({
          section_order: [
            {
              when: "between_songs",
              flow: [
                { ALTERNATIVE: { choices: [{ section: "", weight: 1 }] } },
              ],
            },
          ],
        }),
      ),
    ).toContain("alternative_needs_choice");
    expect(
      validateStationDraftLocal(
        makeStation({
          section_order: [
            { when: "between_songs", flow: [{ OPTIONAL: { section: "" } }] },
          ],
        }),
      ),
    ).toContain("optional_needs_section");
  });
});

describe("flow item helpers", () => {
  it("detects the flow type and creates matching defaults", () => {
    expect(getFlowType({ MUST: "x" })).toBe("MUST");
    expect(getFlowType(makeDefaultFlowItem("ALTERNATIVE"))).toBe("ALTERNATIVE");
    expect(getFlowType(makeDefaultFlowItem("OPTIONAL"))).toBe("OPTIONAL");
  });
});

describe("defaultGuidedPlacement", () => {
  const placementFor = (id: string, name: string) =>
    defaultGuidedPlacement(makeSection({ id, name }));

  it("maps common English markers", () => {
    expect(placementFor("intro", "Show Intro")).toBe("start_of_playlist");
    expect(placementFor("outro", "Show Outro")).toBe("end_of_playlist");
    expect(placementFor("news", "News Flash")).toBe("between_songs");
  });

  it("prefers end markers over a loose intro match", () => {
    // Regression: previously matched "intro" inside "Introduction" first.
    expect(placementFor("song_introduction_end", "Song Introduction End")).toBe(
      "end_of_playlist",
    );
  });

  it("maps German markers", () => {
    expect(placementFor("begruessung", "Begrüßung")).toBe("start_of_playlist");
    expect(placementFor("verabschiedung", "Verabschiedung")).toBe(
      "end_of_playlist",
    );
  });

  it("does not treat words containing 'ende' as end markers", () => {
    expect(placementFor("sendung", "Sendung Spezial")).toBe("between_songs");
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
    expect(at("2026-07-16T11:45:00Z")).toBe("15 minutes ago");
    expect(at("2026-07-16T10:00:00Z")).toBe("2 hours ago");
    expect(at("2026-07-13T12:00:00Z")).toBe("3 days ago");
  });
});

describe("showArtGradient", () => {
  it("is deterministic for the same seed", () => {
    expect(showArtGradient("Morning show")).toBe(
      showArtGradient("Morning show"),
    );
  });

  it("produces different hues for different seeds", () => {
    expect(showArtGradient("Morning show")).not.toBe(
      showArtGradient("Evening show"),
    );
  });

  it("emits a valid two-stop hsl gradient", () => {
    expect(showArtGradient("Morning show")).toMatch(
      /^linear-gradient\(135deg, hsl\(\d+ 65% 45%\), hsl\(\d+ 70% 28%\)\)$/,
    );
  });
});
