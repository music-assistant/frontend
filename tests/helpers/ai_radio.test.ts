import {
  asGeneralDefaults,
  buildSharedShow,
  compileShow,
  decompileStation,
  errorMessage,
  parseSharedShow,
  relativeTimeFromIso,
  sharedShowFileName,
  sharedShowToDraft,
  sharedShowToJson,
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
    defaultPlayerId: "",
    maxDurationMinutes: 0,
    shuffleSourceTracks: true,
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

describe("share/import", () => {
  const makeShareDraft = (): ShowDraft => ({
    basics: {
      id: "late_night",
      name: "Late Night",
      sourcePlaylistId: "42",
      sourcePlaylistProvider: "library",
      defaultPlayerId: "player_1",
      maxDurationMinutes: 90,
      shuffleSourceTracks: false,
      general: {
        instructions: "Host personality: calm.",
        weather_provider: "open_meteo",
        weather_timeout_seconds: 8,
      },
    },
    segments: [
      {
        id: "intro",
        name: "Intro",
        prompt: "Open the show with <next_songinfo>.",
        webSearch: "disabled",
        maxChars: 650,
        plays: { kind: "start" },
      },
      {
        id: "fact",
        name: "Artist fact",
        prompt: "Share one fact.",
        webSearch: "allow",
        maxChars: 500,
        plays: { kind: "every_n_songs", n: 2 },
      },
      {
        id: "weather",
        name: "Weather",
        prompt: "Use <weather_hourly>.",
        webSearch: "force",
        maxChars: 400,
        plays: { kind: "every_n_min", n: 60 },
      },
      {
        id: "sign_off",
        name: "Sign-off",
        prompt: "Say goodbye.",
        webSearch: "disabled",
        maxChars: 300,
        plays: { kind: "occasionally", percent: 25 },
      },
    ],
  });

  const roundTrip = (draft: ShowDraft) =>
    parseSharedShow(sharedShowToJson(buildSharedShow(draft)));

  it("round-trips persona and every segment field", () => {
    const draft = makeShareDraft();
    const imported = sharedShowToDraft(roundTrip(draft), {
      itemId: "99",
      provider: "spotify",
    });

    expect(imported.basics.general.instructions).toBe(
      "Host personality: calm.",
    );
    expect(imported.segments.map((s) => s.name)).toEqual([
      "Intro",
      "Artist fact",
      "Weather",
      "Sign-off",
    ]);
    expect(imported.segments.map((s) => s.webSearch)).toEqual([
      "disabled",
      "allow",
      "force",
      "disabled",
    ]);
    expect(imported.segments.map((s) => s.maxChars)).toEqual([
      650, 500, 400, 300,
    ]);
    expect(imported.segments.map((s) => s.plays)).toEqual(
      draft.segments.map((s) => s.plays),
    );
  });

  it("leaves the playlist, player and station id behind", () => {
    const shared = buildSharedShow(makeShareDraft());
    expect(JSON.stringify(shared)).not.toContain("player_1");
    expect(Object.keys(shared)).toEqual([
      "kind",
      "version",
      "name",
      "instructions",
      "segments",
    ]);

    const imported = sharedShowToDraft(shared);
    expect(imported.basics.sourcePlaylistId).toBe("");
    expect(imported.basics.sourcePlaylistProvider).toBe("library");
    expect(imported.basics.defaultPlayerId).toBe("");
    expect(imported.basics.id).toBeUndefined();
  });

  it("takes the importer's playlist choice", () => {
    const imported = sharedShowToDraft(roundTrip(makeShareDraft()), {
      itemId: "99",
      provider: "spotify",
    });
    expect(imported.basics.sourcePlaylistId).toBe("99");
    expect(imported.basics.sourcePlaylistProvider).toBe("spotify");
  });

  it("drops unknown keys instead of carrying them into the draft", () => {
    // written as raw JSON so "__proto__" survives as a real key — an object
    // literal would set the prototype and JSON.stringify would drop it
    const shared = parseSharedShow(`{
      "kind": "ai_radio_show",
      "version": 1,
      "name": "Sneaky",
      "instructions": "",
      "malicious": "payload",
      "__proto__": { "polluted": true },
      "segments": [
        { "name": "Intro", "prompt": "Hi", "plays": { "kind": "start" },
          "extra": "nope" }
      ]
    }`);

    expect(shared).not.toHaveProperty("malicious");
    expect(shared.segments[0]).not.toHaveProperty("extra");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();

    const imported = sharedShowToDraft(shared);
    expect(Object.keys(imported.segments[0]).sort()).toEqual([
      "id",
      "maxChars",
      "name",
      "plays",
      "prompt",
      "webSearch",
    ]);
  });

  it("gives colliding segment names unique ids", () => {
    const shared = parseSharedShow(
      JSON.stringify({
        kind: "ai_radio_show",
        version: 1,
        name: "Twins",
        segments: [
          { name: "Break", prompt: "One", plays: { kind: "start" } },
          { name: "Break", prompt: "Two", plays: { kind: "end" } },
        ],
      }),
    );
    const ids = sharedShowToDraft(shared).segments.map((s) => s.id);
    expect(ids).toEqual(["break", "break_2"]);
  });

  it("falls back to disabled for an unknown web search mode", () => {
    const shared = parseSharedShow(
      JSON.stringify({
        kind: "ai_radio_show",
        version: 1,
        name: "Odd",
        segments: [
          {
            name: "Intro",
            prompt: "Hi",
            webSearch: "always",
            plays: { kind: "start" },
          },
        ],
      }),
    );
    expect(shared.segments[0].webSearch).toBe("disabled");
  });

  it("rejects documents that are not a valid shared show", () => {
    const invalid = "providers.ai_radio.validation.invalid_import_file";
    const base = {
      kind: "ai_radio_show",
      version: 1,
      name: "Show",
      segments: [{ name: "Intro", prompt: "Hi", plays: { kind: "start" } }],
    };
    const rejects = [
      "not json at all",
      "[]",
      JSON.stringify({ ...base, kind: "something_else" }),
      JSON.stringify({ ...base, version: 2 }),
      JSON.stringify({ ...base, name: "   " }),
      JSON.stringify({ ...base, segments: [] }),
      JSON.stringify({
        ...base,
        segments: [{ name: "Intro", prompt: "", plays: { kind: "start" } }],
      }),
      JSON.stringify({
        ...base,
        segments: [
          { name: "Intro", prompt: { evil: true }, plays: { kind: "start" } },
        ],
      }),
      JSON.stringify({
        ...base,
        segments: [{ name: "Intro", prompt: "Hi", plays: { kind: "never" } }],
      }),
      JSON.stringify({
        ...base,
        segments: [{ name: "Intro", prompt: "x".repeat(8001) }],
      }),
      JSON.stringify({
        ...base,
        segments: Array.from({ length: 51 }, () => ({
          name: "Intro",
          prompt: "Hi",
          plays: { kind: "start" },
        })),
      }),
    ];
    for (const payload of rejects) {
      expect(() => parseSharedShow(payload)).toThrowError(invalid);
    }
  });
});

describe("sharedShowFileName", () => {
  it("slugifies the show name", () => {
    expect(sharedShowFileName("Late Night Deep Cuts")).toBe(
      "late_night_deep_cuts.ai-radio-show.json",
    );
  });
});
