import type {
  AIRadioAlternativeChoice,
  AIRadioFlowItem,
  AIRadioHost,
  AIRadioOptionalGuards,
  AIRadioSection,
  AIRadioSectionOrderRule,
  AIRadioStation,
  AIRadioWebSearchMode,
} from "@/plugins/api/interfaces";
import { $t, canonicalizeLocale, i18n } from "@/plugins/i18n";

// Sentinel for "no selection" in shadcn Select components, which do not
// allow SelectItem values to be empty strings.
export const NONE_SELECT_VALUE = "__none__";

export const deepClone = <T>(value: T): T => {
  return JSON.parse(JSON.stringify(value)) as T;
};

export const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "item";
};

export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const data = error as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "reason"]) {
      if (typeof data[key] === "string" && data[key].trim()) {
        return data[key];
      }
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

export const formatTimestamp = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

/**
 * Localized relative label ("2 hours ago") for an ISO timestamp.
 * `nowMs` is injectable for tests; callers rely on the 5s session polling
 * to keep displayed values fresh, so no ticking is needed.
 */
export const relativeTimeFromIso = (
  value?: string | null,
  nowMs = Date.now(),
): string => {
  if (!value) return "";
  const thenMs = new Date(value).getTime();
  if (Number.isNaN(thenMs)) return "";
  const diffSeconds = Math.round((thenMs - nowMs) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(
    canonicalizeLocale(i18n.global.locale.value),
    {
      numeric: "auto",
      style: "narrow",
    },
  );
  if (absSeconds < 60) return rtf.format(0, "second");
  if (absSeconds < 3600)
    return rtf.format(Math.trunc(diffSeconds / 60), "minute");
  if (absSeconds < 86400)
    return rtf.format(Math.trunc(diffSeconds / 3600), "hour");
  return rtf.format(Math.trunc(diffSeconds / 86400), "day");
};

// -----------------------------------------------------------------------
// Host model: the UI-facing "segment" representation of a host's spoken
// content, and the compiler/decompiler that translate it to/from the
// backend host+section contract (MUST/ALTERNATIVE/OPTIONAL flow items +
// guards).
// -----------------------------------------------------------------------

/** One spoken segment a host can play, edited as a single row in the host editor. */
export interface ShowSegment {
  id: string;
  name: string;
  prompt: string;
  webSearch: AIRadioWebSearchMode;
  maxChars: number;
  plays: PlaysRule;
}

/**
 * When a segment plays, expressed in UI-friendly terms.
 * Compiles down to MUST (start/end/every_song) or OPTIONAL with derived
 * chance/guards (every_n_songs/every_n_min/occasionally) — see compileHost.
 */
export type PlaysRule =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "every_song" }
  | { kind: "every_n_songs"; n: number }
  | { kind: "every_n_min"; n: number }
  | { kind: "occasionally"; percent: number };

export type TalkativenessLevel = "rarely" | "normal" | "chatty";

/** Station-level fields the Customize UI edits. */
export interface ShowBasics {
  id?: string;
  name: string;
  sourcePlaylistId: string;
  sourcePlaylistProvider: string;
  defaultPlayerId: string;
  maxDurationMinutes: number;
  shuffleSourceTracks: boolean;
}

/** A show is just a playlist plus a reference to the host that voices it. */
export interface ShowDraft {
  basics: ShowBasics;
  hostId: string;
}

export type ShowPresetKey =
  | "morning_show"
  | "minimal_dj"
  | "music_nerd"
  | "party_host";

/** A bundled starting point offered in the host editor. */
export interface ShowPreset {
  key: ShowPresetKey;
  /** Kebab-case Lucide icon name, resolved via helpers/icon.ts#getLucideIcon. */
  icon: string;
  segments: ShowSegment[];
  /** Seeds HostDraft.instructions — the host personality + program style. */
  instructions: string;
}

const SONG_TRANSITION_PROMPT =
  "The previous track was <prev_songinfo> and the next track is <next_songinfo>. Create a natural radio transition that connects both songs, sounds informed but concise, and avoids filler or repetition.";

export const PRESETS: ShowPreset[] = [
  {
    key: "morning_show",
    icon: "sunrise",
    instructions:
      "Host personality: warm, energetic, upbeat morning-show host who sounds fully awake and glad to be on air. Program instructions: write for spoken delivery, keep segments concise, avoid bullet-point phrasing, avoid cliches, mention concrete details when available, and maintain a believable radio flow between sections.",
    segments: [
      {
        id: "intro",
        name: "Intro",
        prompt:
          "The next track is <next_songinfo>. Open the morning show like a warm, upbeat host: brief good-morning greeting, one concrete hook about the song or artist, and a clean handoff into the music.",
        webSearch: "disabled",
        maxChars: 650,
        plays: { kind: "start" },
      },
      {
        id: "transition",
        name: "Transition",
        prompt:
          "The previous track was <prev_songinfo> and the next track is <next_songinfo>. Create a natural, energetic morning-show transition that connects both songs, sounds informed but concise, and avoids filler or repetition.",
        webSearch: "allow",
        maxChars: 650,
        plays: { kind: "every_n_songs", n: 3 },
      },
      {
        id: "weather",
        name: "Weather",
        prompt:
          "Using <weather_hourly> and <timestamp>, deliver a short spoken weather update with the current outlook, a useful next-hours summary, and smooth morning-show phrasing.",
        webSearch: "disabled",
        maxChars: 500,
        plays: { kind: "every_n_min", n: 60 },
      },
      {
        id: "news",
        name: "News",
        prompt:
          "Create a short global news bulletin anchored to <timestamp>. Use web search. Include two or three current items that are broadly relevant, clearly separated, fact-focused, and written for spoken delivery.",
        webSearch: "force",
        maxChars: 700,
        plays: { kind: "every_n_min", n: 60 },
      },
      {
        id: "sign_off",
        name: "Sign-off",
        prompt:
          "The last track played was <prev_songinfo>. Close the morning show with a memorable sign-off: brief reflection, warm farewell, and language that sounds like the end of a real radio segment.",
        webSearch: "disabled",
        maxChars: 650,
        plays: { kind: "end" },
      },
    ],
  },
  {
    key: "minimal_dj",
    icon: "disc-3",
    instructions:
      "Host personality: minimal, calm, understated DJ who lets the music lead. Program instructions: keep every segment brief, avoid small talk, avoid cliches, and never overshadow the songs with unnecessary commentary.",
    segments: [
      {
        id: "transition",
        name: "Transition",
        prompt:
          "The previous track was <prev_songinfo> and the next track is <next_songinfo>. Give a short, minimal DJ transition: one or two sentences, calm tone, no filler, just enough to bridge the songs.",
        webSearch: "disabled",
        maxChars: 300,
        plays: { kind: "every_n_songs", n: 3 },
      },
    ],
  },
  {
    key: "music_nerd",
    icon: "book-open",
    instructions:
      "Host personality: knowledgeable, enthusiastic music nerd who loves sharing context without lecturing. Program instructions: write for spoken delivery, keep segments concise, favor concrete facts over generic praise, avoid cliches, and maintain a believable radio flow between sections.",
    segments: [
      {
        id: "intro",
        name: "Intro",
        prompt:
          "The next track is <next_songinfo>. Open the program like a knowledgeable music host: brief welcome, one genuinely interesting detail about the artist or genre, and a clean handoff into the music.",
        webSearch: "disabled",
        maxChars: 650,
        plays: { kind: "start" },
      },
      {
        id: "artist_fact",
        name: "Artist fact",
        prompt:
          "The next track is <next_songinfo>. Share one specific, well-researched fact about the artist, the recording, or its influence. Keep it precise and avoid generic trivia.",
        webSearch: "allow",
        maxChars: 500,
        plays: { kind: "every_n_songs", n: 2 },
      },
      {
        id: "transition",
        name: "Transition",
        prompt: SONG_TRANSITION_PROMPT,
        webSearch: "allow",
        maxChars: 650,
        plays: { kind: "every_song" },
      },
    ],
  },
  {
    key: "party_host",
    icon: "party-popper",
    instructions:
      "Host personality: high-energy, confident party host who keeps the crowd hyped. Program instructions: write for spoken delivery, keep segments concise, avoid bullet-point phrasing, avoid cliches, and maintain a believable, energetic radio flow between sections.",
    segments: [
      {
        id: "hype_intro",
        name: "Hype intro",
        prompt:
          "The next track is <next_songinfo>. Open the party like a hype radio host: high energy, one confident line about the song or artist, and a clean handoff that gets people moving.",
        webSearch: "disabled",
        maxChars: 650,
        plays: { kind: "start" },
      },
      {
        id: "shout_out",
        name: "Shout-out",
        prompt:
          "The previous track was <prev_songinfo> and the next track is <next_songinfo>. Deliver a high-energy party transition with a quick shout-out vibe: keep it fun, confident, and concise, and avoid filler or repetition.",
        webSearch: "allow",
        maxChars: 650,
        plays: { kind: "every_n_songs", n: 3 },
      },
      {
        id: "sign_off",
        name: "Sign-off",
        prompt:
          "The last track played was <prev_songinfo>. Close the party with a memorable, high-energy sign-off: brief hype recap, warm farewell, and language that sounds like the end of a real party set.",
        webSearch: "disabled",
        maxChars: 650,
        plays: { kind: "end" },
      },
    ],
  },
];

/**
 * Adjusts a preset's segment frequencies for the create dialog's talkativeness
 * slider. Treats every_song/every_n_songs segments as "the transition" (the
 * main recurring host segment) and every_n_min/occasionally segments as
 * "extras" (weather, news, facts); start/end segments are never adjusted.
 */
export const applyTalkativeness = (
  segments: ShowSegment[],
  level: TalkativenessLevel,
): ShowSegment[] => {
  if (level === "normal") {
    return segments;
  }
  return segments.map((segment) => {
    const { plays } = segment;
    if (plays.kind === "start" || plays.kind === "end") {
      return segment;
    }
    if (plays.kind === "every_song" || plays.kind === "every_n_songs") {
      if (level === "rarely") {
        return { ...segment, plays: { kind: "every_n_songs", n: 3 } };
      }
      return { ...segment, plays: { kind: "every_song" } };
    }
    // Extras: halve frequency for "rarely", leave untouched for "chatty".
    if (level === "rarely") {
      if (plays.kind === "every_n_min") {
        return { ...segment, plays: { kind: "every_n_min", n: plays.n * 2 } };
      }
      if (plays.kind === "occasionally") {
        return {
          ...segment,
          plays: {
            kind: "occasionally",
            percent: Math.max(1, Math.round(plays.percent / 2)),
          },
        };
      }
    }
    return segment;
  });
};

/** Prompt for the hidden ai_meta merge section, verbatim from the backend example. */
export const MERGE_SECTION_PROMPT =
  "Merge the drafts below into one coherent radio break. Preserve factual content, remove duplication, and make the final segment sound like one host speaking naturally.\n<section_drafts>";

const GUARD_PLACEHOLDER_TOKENS = ["<weather_hourly>", "<timestamp>"] as const;

const detectRequiredPlaceholders = (prompt: string): string[] => {
  return GUARD_PLACEHOLDER_TOKENS.filter((token) => prompt.includes(token));
};

const buildOptionalGuards = (
  prompt: string,
  minGapSongs: number,
  maxPer60min: number,
): AIRadioOptionalGuards => ({
  min_gap_songs: minGapSongs,
  max_per_60min: maxPer60min,
  require_placeholders_present: detectRequiredPlaceholders(prompt),
});

const flowItemForBetweenSegment = (segment: ShowSegment): AIRadioFlowItem => {
  const { plays } = segment;
  switch (plays.kind) {
    case "every_n_songs": {
      const n = Math.max(1, plays.n);
      return {
        OPTIONAL: {
          section: segment.id,
          chance: Math.min(1, 2 / n),
          guards: buildOptionalGuards(segment.prompt, n - 1, 0),
        },
      };
    }
    case "every_n_min": {
      const n = Math.max(1, plays.n);
      return {
        OPTIONAL: {
          section: segment.id,
          chance: 1,
          guards: buildOptionalGuards(segment.prompt, 0, Math.round(60 / n)),
        },
      };
    }
    case "occasionally": {
      const percent = Math.min(100, Math.max(0, plays.percent));
      return {
        OPTIONAL: {
          section: segment.id,
          chance: percent / 100,
          guards: buildOptionalGuards(segment.prompt, 1, 0),
        },
      };
    }
    // every_song (start/end never reach this list, see compileShow).
    default:
      return { MUST: segment.id };
  }
};

/** Appends numeric suffixes until `id` is not already in `used`, then reserves it. */
const dedupeId = (id: string, used: Set<string>): string => {
  let candidate = id;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${id}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
};

interface CompiledSegments {
  sections: AIRadioSection[];
  sectionOrder: AIRadioSectionOrderRule[];
  mergeSectionId: string;
}

/**
 * Builds one AIRadioSection per segment plus a hidden ai_meta merge section,
 * and a section_order per segment.plays (start/end -> MUST rules in list
 * order, everything else -> a single between_songs rule where every_song is
 * MUST and the rest are OPTIONAL with derived chance/guards). `hostId` seeds
 * the merge section's id and namespaces every regular segment id (hosts'
 * sections live in the flat shared ai_radio/sections namespace, so two hosts
 * must not be able to collide on e.g. both having an "intro"). The prefix
 * check is idempotent: an id already carrying it (round-tripped back from
 * decompileHost into the draft) is left alone rather than re-prefixed on
 * every subsequent compile.
 */
const compileSegments = (
  segments: ShowSegment[],
  hostId: string,
): CompiledSegments => {
  const usedIds = new Set<string>();

  const sections: AIRadioSection[] = [];
  const resolved = segments.map((segment) => {
    const rawId = segment.id || segment.name;
    const prefix = `${hostId}_`;
    const namespacedId = rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
    const id = dedupeId(slugify(namespacedId), usedIds);
    sections.push({
      id,
      name: segment.name,
      type: "ai_text",
      web_search: segment.webSearch,
      prompt: segment.prompt,
      constraints: { max_chars: segment.maxChars },
    });
    return { ...segment, id };
  });

  const startSegments = resolved.filter((s) => s.plays.kind === "start");
  const endSegments = resolved.filter((s) => s.plays.kind === "end");
  const betweenSegments = resolved.filter(
    (s) => s.plays.kind !== "start" && s.plays.kind !== "end",
  );

  const sectionOrder: AIRadioSectionOrderRule[] = [];
  if (startSegments.length) {
    sectionOrder.push({
      when: "start_of_playlist",
      flow: startSegments.map((s) => ({ MUST: s.id })),
    });
  }
  if (betweenSegments.length) {
    sectionOrder.push({
      when: "between_songs",
      flow: betweenSegments.map((s) =>
        s.plays.kind === "every_song"
          ? { MUST: s.id }
          : flowItemForBetweenSegment(s),
      ),
    });
  }
  if (endSegments.length) {
    sectionOrder.push({
      when: "end_of_playlist",
      flow: endSegments.map((s) => ({ MUST: s.id })),
    });
  }

  const mergeSectionId = dedupeId(`${hostId}_smoother`, usedIds);
  sections.push({
    id: mergeSectionId,
    name: "Between Songs Mix",
    type: "ai_meta",
    prompt: MERGE_SECTION_PROMPT,
  });

  return { sections, sectionOrder, mergeSectionId };
};

/** Compiles a show draft into the station payload the backend expects: a playlist reference plus its host. */
export const compileShow = (draft: ShowDraft): AIRadioStation => {
  const stationId = draft.basics.id?.trim() || slugify(draft.basics.name);

  return {
    id: stationId,
    name: draft.basics.name.trim(),
    source_playlist_id: draft.basics.sourcePlaylistId,
    source_playlist_provider: draft.basics.sourcePlaylistProvider || "library",
    default_player_id: draft.basics.defaultPlayerId || "",
    max_duration_minutes: draft.basics.maxDurationMinutes,
    shuffle_source_tracks: draft.basics.shuffleSourceTracks,
    host_id: draft.hostId,
  };
};

/** A host's persona/voice, edited in the Hosts UI and assignable to a queue's DJ. */
export interface HostDraft {
  id: string;
  name: string;
  instructions: string;
  // ttsEngine: "" = provider default
  ttsEngine: string;
  segments: ShowSegment[];
  talkativeness: TalkativenessLevel;
}

export interface CompiledHost {
  host: AIRadioHost;
  sections: AIRadioSection[];
}

/**
 * Compiles a host draft into the AIRadioHost payload the backend expects
 * plus the AIRadioSection content it references, applying talkativeness and
 * running the segment/section_order compilation (see compileSegments).
 * Sections are returned rather than embedded: v3 hosts don't carry section
 * content, so callers must persist them explicitly (ai_radio/sections/save)
 * before saving the host. Section ids are namespaced with the host id so two
 * hosts never collide in the shared sections library.
 */
export const compileHost = (draft: HostDraft): CompiledHost => {
  const hostId = draft.id.trim() || slugify(draft.name);
  const segments = applyTalkativeness(draft.segments, draft.talkativeness);
  const { sections, sectionOrder, mergeSectionId } = compileSegments(
    segments,
    hostId,
  );

  return {
    host: {
      id: hostId,
      name: draft.name.trim(),
      instructions: draft.instructions,
      tts_engine: draft.ttsEngine,
      section_ids: sections.map((section) => section.id),
      section_order: sectionOrder,
      merge_section_id: mergeSectionId,
    },
    sections,
  };
};

export interface DecompiledShow {
  basics: ShowBasics;
  hostId: string;
}

/**
 * Inverts a section_order's start/between/end rules into a flat segment
 * list, given a `toSegment` lookup that turns a section id + derived plays
 * rule into a ShowSegment (or null to drop it, e.g. the hidden merge
 * section). Mirrors compileSegments' exact chance/guard formulas where
 * possible, falling back to a raw "occasionally" percent otherwise (flagged
 * via the returned `lossy` bit). Used by decompileHost.
 */
const decompileSectionOrder = (
  sectionOrder: AIRadioSectionOrderRule[] | undefined,
  toSegment: (sectionId: string, plays: PlaysRule) => ShowSegment | null,
): { segments: ShowSegment[]; lossy: boolean } => {
  let lossy = false;

  const decompileBetweenItem = (item: AIRadioFlowItem): ShowSegment[] => {
    if ("MUST" in item) {
      const segment = toSegment(item.MUST, { kind: "every_song" });
      return segment ? [segment] : [];
    }
    if ("ALTERNATIVE" in item) {
      const choices: AIRadioAlternativeChoice[] =
        item.ALTERNATIVE.choices || [];
      if (choices.length === 1) {
        const segment = toSegment(choices[0].section, { kind: "every_song" });
        return segment ? [segment] : [];
      }
      lossy = true;
      const total = choices.reduce((sum, c) => sum + (c.weight || 0), 0) || 1;
      return choices
        .map((choice) =>
          toSegment(choice.section, {
            kind: "occasionally",
            percent: Math.round((choice.weight / total) * 100),
          }),
        )
        .filter((s): s is ShowSegment => s !== null);
    }
    // OPTIONAL: invert compileSegments' exact chance/guard formulas where
    // possible, otherwise fall back to a plain "occasionally" percent.
    const { section: sectionId, chance = 0, guards } = item.OPTIONAL;
    const minGap = guards?.min_gap_songs || 0;
    const maxPer60 = guards?.max_per_60min || 0;
    let plays: PlaysRule;
    if (maxPer60 > 0 && Math.abs(chance - 1) < 1e-6) {
      plays = {
        kind: "every_n_min",
        n: Math.max(1, Math.round(60 / maxPer60)),
      };
    } else if (
      minGap > 0 &&
      Math.abs(chance - Math.min(1, 2 / (minGap + 1))) < 1e-6
    ) {
      plays = { kind: "every_n_songs", n: minGap + 1 };
    } else {
      lossy = true;
      plays = { kind: "occasionally", percent: Math.round(chance * 100) };
    }
    const segment = toSegment(sectionId, plays);
    return segment ? [segment] : [];
  };

  const segments: ShowSegment[] = [];
  for (const rule of sectionOrder || []) {
    if (rule.when === "start_of_playlist" || rule.when === "end_of_playlist") {
      const kind: PlaysRule["kind"] =
        rule.when === "start_of_playlist" ? "start" : "end";
      for (const item of rule.flow) {
        if ("MUST" in item) {
          const segment = toSegment(item.MUST, { kind });
          if (segment) segments.push(segment);
        }
      }
      continue;
    }
    for (const item of rule.flow) {
      segments.push(...decompileBetweenItem(item));
    }
  }

  return { segments, lossy };
};

/** Inverse of compileShow, for opening an existing station in the Customize view. */
export const decompileStation = (station: AIRadioStation): DecompiledShow => {
  const basics: ShowBasics = {
    id: station.id,
    name: station.name,
    sourcePlaylistId: station.source_playlist_id,
    sourcePlaylistProvider: station.source_playlist_provider || "library",
    defaultPlayerId: station.default_player_id || "",
    maxDurationMinutes: station.max_duration_minutes || 0,
    shuffleSourceTracks: station.shuffle_source_tracks !== false,
  };

  return { basics, hostId: station.host_id };
};

/**
 * Best-effort inverse of compileHost, for opening an existing host in the
 * Hosts UI. `sections` is the section content library the host's
 * section_ids reference (e.g. loaded via ai_radio/sections/list).
 * talkativeness can't be inverted from section_order, so it always resets
 * to "normal".
 */
export const decompileHost = (
  host: AIRadioHost,
  sections: AIRadioSection[],
): HostDraft => {
  const sectionMap = new Map<string, AIRadioSection>();
  for (const section of sections) {
    sectionMap.set(section.id, section);
  }
  const mergeId = host.merge_section_id || "";

  const toSegment = (
    sectionId: string,
    plays: PlaysRule,
  ): ShowSegment | null => {
    const section = sectionMap.get(sectionId);
    if (!section || section.id === mergeId || section.type === "ai_meta") {
      return null;
    }
    return {
      id: section.id,
      name: section.name,
      prompt: section.prompt,
      webSearch: section.web_search || "disabled",
      maxChars: section.constraints?.max_chars || 0,
      plays,
    };
  };

  const { segments } = decompileSectionOrder(host.section_order, toSegment);

  return {
    id: host.id,
    name: host.name,
    instructions: host.instructions,
    ttsEngine: host.tts_engine,
    segments,
    talkativeness: "normal",
  };
};

const PLAYS_RULE_LABEL_KEYS: Record<PlaysRule["kind"], string> = {
  start: "providers.ai_radio.plays.start",
  end: "providers.ai_radio.plays.end",
  every_song: "providers.ai_radio.plays.every_song",
  every_n_songs: "providers.ai_radio.plays.every_n_songs",
  every_n_min: "providers.ai_radio.plays.every_n_min",
  occasionally: "providers.ai_radio.plays.occasionally",
};

/** Human-readable label for a plays rule, e.g. "Every ~4 songs". */
export const playsRuleLabel = (rule: PlaysRule): string => {
  const key = PLAYS_RULE_LABEL_KEYS[rule.kind];
  if (rule.kind === "every_n_songs" || rule.kind === "every_n_min") {
    return $t(key, [rule.n]);
  }
  if (rule.kind === "occasionally") {
    return $t(key, [rule.percent]);
  }
  return $t(key);
};

/** Player to start a show on: its own default, else the currently active player, else none. */
export const resolveShowPlayerId = (
  station: Pick<AIRadioStation, "default_player_id">,
  activePlayerId: string | undefined,
): string => {
  return station.default_player_id || activePlayerId || "";
};

export const getQueryValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};
