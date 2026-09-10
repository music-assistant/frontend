import {
  compileHost,
  compileShow,
  decompileHost,
  decompileStation,
  errorMessage,
  GENERIC_SEGMENT_TEMPLATES,
  MERGE_SECTION_PROMPT,
  slugify,
} from "@/helpers/ai_radio";
import type { HostDraft, ShowDraft } from "@/helpers/ai_radio";
import type {
  AIRadioHost,
  AIRadioSection,
  AIRadioStation,
} from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";

const artistFactTemplate = GENERIC_SEGMENT_TEMPLATES.find(
  (t) => t.id === "artist_fact",
);
if (!artistFactTemplate) {
  throw new Error("GENERIC_SEGMENT_TEMPLATES is missing artist_fact");
}

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  canonicalizeLocale: (locale: string) => locale.replaceAll("_", "-"),
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

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
    ...overrides,
  },
  hostId: "rick",
});

const makeStation = (
  overrides: Partial<AIRadioStation> = {},
): AIRadioStation => ({
  id: "my_station",
  name: "My Station",
  source_playlist_id: "42",
  source_playlist_provider: "library",
  host_id: "rick",
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

describe("compileShow", () => {
  it("writes shuffle_source_tracks from the draft", () => {
    const draft = makeDraft({ shuffleSourceTracks: false });
    expect(compileShow(draft).shuffle_source_tracks).toBe(false);
  });

  it("carries the draft's host id as host_id", () => {
    const draft = { ...makeDraft(), hostId: "morning_dj" };
    expect(compileShow(draft).host_id).toBe("morning_dj");
  });
});

describe("decompileStation", () => {
  it("defaults shuffleSourceTracks to true when absent from the station", () => {
    const { basics } = decompileStation(makeStation());
    expect(basics.shuffleSourceTracks).toBe(true);
  });

  it("carries the station's host_id as hostId", () => {
    const { hostId } = decompileStation(makeStation({ host_id: "morning_dj" }));
    expect(hostId).toBe("morning_dj");
  });
});

describe("compileHost", () => {
  it("compiles segments into section_order, returning section content", () => {
    const draft: HostDraft = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: GENERIC_SEGMENT_TEMPLATES.slice(0, 2).map((s) => ({ ...s })),
    };
    const { host, sections } = compileHost(draft);
    expect(host.id).toBe("rick");
    expect(host.instructions).toBe("Persona.");
    expect(host.section_ids.length).toBeGreaterThan(0);
    expect(host.section_order.length).toBeGreaterThan(0);
    // sections must carry full content (not just ids) so the host save flow
    // can persist them via ai_radio/sections/save before saving the host.
    expect(sections.map((s) => s.id)).toEqual(host.section_ids);
    expect(sections.find((s) => s.id === "rick_intro")?.prompt).toBe(
      draft.segments[0].prompt,
    );
  });

  it("namespaces section ids with the host id, so two hosts never collide in the shared sections library", () => {
    const draftFor = (hostId: string): HostDraft => ({
      id: hostId,
      name: hostId,
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: GENERIC_SEGMENT_TEMPLATES.slice(0, 2).map((s) => ({ ...s })),
    });
    const a = compileHost(draftFor("host_a"));
    const b = compileHost(draftFor("host_b"));

    const idsA = new Set(a.sections.map((s) => s.id));
    const idsB = new Set(b.sections.map((s) => s.id));
    expect(idsA.size).toBeGreaterThan(0);
    expect([...idsA].some((id) => idsB.has(id))).toBe(false);
    expect(a.host.merge_section_id).not.toBe(b.host.merge_section_id);
  });

  it("leaves an already-namespaced segment id alone (idempotent across repeated edit/save cycles)", () => {
    const draft: HostDraft = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: [{ ...GENERIC_SEGMENT_TEMPLATES[0], id: "rick_intro" }],
    };
    const { sections } = compileHost(draft);
    expect(sections.map((s) => s.id)).toEqual(["rick_intro", "rick_smoother"]);
  });

  it("compiles every_n_songs so a gap of exactly n songs since the last play satisfies the guard", () => {
    // min_gap_songs must equal n, not n - 1: since consecutive songs differ
    // by exactly 1, n - 1 would satisfy the server's gap check one song early.
    const draft: HostDraft = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: [
        {
          ...artistFactTemplate,
          plays: { kind: "every_n_songs", n: 3 },
        },
      ],
    };
    const { host } = compileHost(draft);
    const rule = host.section_order.find((r) => r.when === "between_songs");
    const item = rule?.flow[0];
    expect(
      item && "OPTIONAL" in item
        ? item.OPTIONAL.guards?.min_gap_songs
        : undefined,
    ).toBe(3);
    expect(
      item && "OPTIONAL" in item ? item.OPTIONAL.chance : undefined,
    ).toBeCloseTo(2 / 3);
  });
});

describe("decompileHost", () => {
  it("round-trips a compiled host given its section content", () => {
    const draft: HostDraft = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "engine-1",
      language: "",
      options: {},
      segments: GENERIC_SEGMENT_TEMPLATES.slice(0, 2).map((s) => ({ ...s })),
    };
    const { host, sections } = compileHost(draft);
    const round = decompileHost(host, sections);
    expect(round.name).toBe("Rick");
    expect(round.ttsEngine).toBe("engine-1");
    // A real sectionMap lookup recovers segments exactly except ids, which
    // compileHost namespaces with the host id.
    expect(round.segments).toEqual(
      draft.segments.map((s) => ({ ...s, id: `rick_${s.id}` })),
    );
  });

  it("excludes the hidden merge section even when section_order references it directly", () => {
    const draft: HostDraft = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: GENERIC_SEGMENT_TEMPLATES.slice(0, 2).map((s) => ({ ...s })),
    };
    const { host, sections } = compileHost(draft);
    // Force a MUST rule pointing at the merge section id, to prove toSegment's
    // mergeId/ai_meta filter runs (it never appears in a real section_order).
    const hostWithMergeInOrder = {
      ...host,
      section_order: [
        ...host.section_order,
        {
          when: "end_of_playlist" as const,
          flow: [{ MUST: host.merge_section_id }],
        },
      ],
    };
    const round = decompileHost(hostWithMergeInOrder, sections);
    expect(round.segments.some((s) => s.id === host.merge_section_id)).toBe(
      false,
    );
  });

  it("round-trips every_n_songs without collapsing into occasionally", () => {
    const draft: HostDraft = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: [{ ...artistFactTemplate }], // every_n_songs n: 3
    };
    const { host, sections } = compileHost(draft);
    const round = decompileHost(host, sections);
    expect(round.segments).toEqual([
      { ...draft.segments[0], id: "rick_artist_fact" },
    ]);
  });

  it("decompiles the legacy every_n_songs shape (min_gap = n - 1) and upgrades it to the new shape on recompile", () => {
    // Released builds used min_gap_songs = n - 1 (v2->v3 migration copies
    // section_order verbatim); must decompile to n and recompile to the n shape.
    const legacySection: AIRadioSection = {
      id: "rick_artist_fact",
      name: "Artist fact",
      type: "ai_text",
      web_search: "allow",
      prompt: artistFactTemplate.prompt,
      constraints: { max_chars: 500 },
    };
    const mergeSection: AIRadioSection = {
      id: "rick_smoother",
      name: "Between Songs Mix",
      type: "ai_meta",
      prompt: MERGE_SECTION_PROMPT,
    };
    const legacyHost: AIRadioHost = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      tts_engine: "",
      language: "",
      options: {},
      section_ids: [legacySection.id, mergeSection.id],
      section_order: [
        {
          when: "between_songs",
          flow: [
            {
              OPTIONAL: {
                section: legacySection.id,
                chance: 2 / 3,
                guards: {
                  min_gap_songs: 2,
                  max_per_60min: 0,
                  require_placeholders_present: [],
                },
              },
            },
          ],
        },
      ],
      merge_section_id: mergeSection.id,
    };

    const round = decompileHost(legacyHost, [legacySection, mergeSection]);
    expect(round.segments).toEqual([
      {
        id: legacySection.id,
        name: legacySection.name,
        prompt: legacySection.prompt,
        webSearch: "allow",
        maxChars: 500,
        plays: { kind: "every_n_songs", n: 3 },
      },
    ]);

    const { host: recompiled } = compileHost({
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: round.segments,
    });
    const rule = recompiled.section_order.find(
      (r) => r.when === "between_songs",
    );
    const item = rule?.flow[0];
    expect(
      item && "OPTIONAL" in item
        ? item.OPTIONAL.guards?.min_gap_songs
        : undefined,
    ).toBe(3);
    expect(
      item && "OPTIONAL" in item ? item.OPTIONAL.chance : undefined,
    ).toBeCloseTo(2 / 3);
  });
});
