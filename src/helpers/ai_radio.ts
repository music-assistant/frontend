import type {
  AIRadioAlternativeChoice,
  AIRadioFlowItem,
  AIRadioOptionalGuards,
  AIRadioSection,
  AIRadioSectionOrderRule,
  AIRadioStation,
  AIRadioStationGeneral,
  AIRadioWebSearchMode,
} from "@/plugins/api/interfaces";
import { $t, i18n } from "@/plugins/i18n";

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
  const rtf = new Intl.RelativeTimeFormat(i18n.global.locale.value, {
    numeric: "auto",
    style: "narrow",
  });
  if (absSeconds < 60) return rtf.format(0, "second");
  if (absSeconds < 3600)
    return rtf.format(Math.trunc(diffSeconds / 60), "minute");
  if (absSeconds < 86400)
    return rtf.format(Math.trunc(diffSeconds / 3600), "hour");
  return rtf.format(Math.trunc(diffSeconds / 86400), "day");
};

export const asGeneralDefaults = (
  general?: AIRadioStationGeneral,
): AIRadioStationGeneral => {
  return {
    instructions: general?.instructions || "",
    weather_provider: general?.weather_provider || "open_meteo",
    weather_timeout_seconds:
      typeof general?.weather_timeout_seconds === "number"
        ? general.weather_timeout_seconds
        : 8,
  };
};

// -----------------------------------------------------------------------
// Show model: the UI-facing "segment" representation of a station, and the
// compiler/decompiler that translate it to/from the backend station+section
// contract (MUST/ALTERNATIVE/OPTIONAL flow items + guards).
// -----------------------------------------------------------------------

/** One spoken segment in a show, edited as a single row in the Customize UI. */
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
 * chance/guards (every_n_songs/every_n_min/occasionally) — see compileShow.
 */
export type PlaysRule =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "every_song" }
  | { kind: "every_n_songs"; n: number }
  | { kind: "every_n_min"; n: number }
  | { kind: "occasionally"; percent: number };

export type TalkativenessLevel = "rarely" | "normal" | "chatty";

/** Station-level fields the Customize UI edits outside of the segment list. */
export interface ShowBasics {
  id?: string;
  name: string;
  sourcePlaylistId: string;
  sourcePlaylistProvider: string;
  targetPlaylistProvider: string;
  defaultPlayerId: string;
  maxDurationMinutes: number;
  shuffleSourceTracks: boolean;
  dynamicBatchSize: number;
  dynamicPollSeconds: number;
  dynamicPrefetchRemainingTracks: number;
  clearQueueOnStart: boolean;
  general: AIRadioStationGeneral;
}

export interface ShowDraft {
  basics: ShowBasics;
  segments: ShowSegment[];
}

export type ShowPresetKey =
  | "morning_show"
  | "minimal_dj"
  | "music_nerd"
  | "party_host";

/** A bundled host-style starting point offered in the create dialog. */
export interface ShowPreset {
  key: ShowPresetKey;
  /** Kebab-case Lucide icon name, resolved via helpers/icon.ts#getLucideIcon. */
  icon: string;
  segments: ShowSegment[];
  /** Seeds general.instructions — the host personality + program style. */
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

/**
 * Compiles a show draft into the full station payload the backend expects:
 * one AIRadioSection per segment plus a hidden ai_meta merge section, and a
 * section_order built per segment.plays (start/end -> MUST rules in list
 * order, everything else -> a single between_songs rule where every_song is
 * MUST and the rest are OPTIONAL with derived chance/guards).
 */
export const compileShow = (draft: ShowDraft): AIRadioStation => {
  const stationId = draft.basics.id?.trim() || slugify(draft.basics.name);
  const usedIds = new Set<string>();

  const sections: AIRadioSection[] = [];
  const resolved = draft.segments.map((segment) => {
    const id = dedupeId(slugify(segment.id || segment.name), usedIds);
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

  const mergeSectionId = dedupeId(`${stationId}_smoother`, usedIds);
  sections.push({
    id: mergeSectionId,
    name: "Between Songs Mix",
    type: "ai_meta",
    prompt: MERGE_SECTION_PROMPT,
  });

  return {
    id: stationId,
    name: draft.basics.name.trim(),
    source_playlist_id: draft.basics.sourcePlaylistId,
    source_playlist_provider: draft.basics.sourcePlaylistProvider || "library",
    target_playlist_provider: draft.basics.targetPlaylistProvider || "builtin",
    default_player_id: draft.basics.defaultPlayerId || "",
    max_duration_minutes: draft.basics.maxDurationMinutes,
    shuffle_source_tracks: draft.basics.shuffleSourceTracks,
    dynamic_batch_size: draft.basics.dynamicBatchSize,
    dynamic_poll_seconds: draft.basics.dynamicPollSeconds,
    dynamic_prefetch_remaining_tracks:
      draft.basics.dynamicPrefetchRemainingTracks,
    clear_queue_on_start: draft.basics.clearQueueOnStart,
    merge_section_id: mergeSectionId,
    general: draft.basics.general,
    sections,
    section_order: sectionOrder,
  };
};

export interface DecompiledShow {
  basics: ShowBasics;
  segments: ShowSegment[];
  /**
   * True when decompiling hit one of the lossy fallback cases below — the
   * Customize UI shows a warning that saving will rewrite the show in the
   * simplified segment format.
   */
  lossy: boolean;
}

/**
 * Best-effort inverse of compileShow, for opening an existing/imported
 * station in the Customize view. Lossy cases (flagged via the returned
 * `lossy` bit):
 * - ALTERNATIVE with >1 choice decompiles to N independent "occasionally"
 *   segments (weight -> percent of the total); the original weighted
 *   pick-one semantics can't be reconstructed from independent chances.
 * - An OPTIONAL item whose guards don't match one of compileShow's exact
 *   chance/guard formulas falls back to "occasionally" using its raw chance.
 * The hidden merge section (station.merge_section_id / type "ai_meta") is
 * always excluded from the segment list.
 */
export const decompileStation = (
  station: AIRadioStation,
  sections: AIRadioSection[],
): DecompiledShow => {
  let lossy = false;
  const sectionMap = new Map<string, AIRadioSection>();
  for (const section of sections) {
    sectionMap.set(section.id, section);
  }
  // Embedded sections take precedence over the shared library fallback.
  for (const section of station.sections || []) {
    sectionMap.set(section.id, section);
  }
  const mergeId = station.merge_section_id || "";

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
    // OPTIONAL: invert compileShow's exact chance/guard formulas where
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
  for (const rule of station.section_order || []) {
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

  const basics: ShowBasics = {
    id: station.id,
    name: station.name,
    sourcePlaylistId: station.source_playlist_id,
    sourcePlaylistProvider: station.source_playlist_provider || "library",
    targetPlaylistProvider: station.target_playlist_provider || "builtin",
    defaultPlayerId: station.default_player_id || "",
    maxDurationMinutes: station.max_duration_minutes || 0,
    shuffleSourceTracks: station.shuffle_source_tracks !== false,
    dynamicBatchSize: station.dynamic_batch_size || 3,
    dynamicPollSeconds: station.dynamic_poll_seconds || 5,
    dynamicPrefetchRemainingTracks:
      station.dynamic_prefetch_remaining_tracks || 2,
    clearQueueOnStart: station.clear_queue_on_start !== false,
    general: asGeneralDefaults(station.general),
  };

  return { basics, segments, lossy };
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
