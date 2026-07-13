import type {
  AIRadioAlternativeChoice,
  AIRadioFlowItem,
  AIRadioOptionalGuards,
  AIRadioPlacement,
  AIRadioSection,
  AIRadioStation,
  AIRadioStationGeneral,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

// Sentinel for "no selection" in shadcn Select components, which do not
// allow SelectItem values to be empty strings.
export const NONE_SELECT_VALUE = "__none__";

export type AIRadioFlowType = "MUST" | "ALTERNATIVE" | "OPTIONAL";

export type AIRadioStationDraft = Omit<AIRadioStation, "general"> & {
  general: AIRadioStationGeneral;
};

export const deepClone = <T>(value: T): T => {
  return JSON.parse(JSON.stringify(value)) as T;
};

export const safeNumber = (
  value: string | number,
  min: number,
  fallback: number,
): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

export const safeInteger = (
  value: string | number,
  min: number,
  fallback: number,
): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

export const parseOptionalNumber = (
  value: string | number | null | undefined,
): number => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return safeNumber(value, 0, 0);
};

export const parseOptionalCapInput = (
  value: string | number | null | undefined,
): number | undefined => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
};

export const parseOptionalPositiveInt = (
  value: string | number | null | undefined,
): number | undefined => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
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

export const exportJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const playlistSelectValue = (provider: string, itemId: string) => {
  return `${provider}:::${itemId}`;
};

export const splitPlaylistSelectValue = (value: string) => {
  const [provider, itemId] = value.split(":::");
  return {
    provider: provider || "library",
    itemId: itemId || "",
  };
};

export const getQueryValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export const asGeneralDefaults = (
  general?: AIRadioStationGeneral,
): AIRadioStationGeneral => {
  return {
    timezone: general?.timezone || "UTC",
    location: {
      city: general?.location?.city || "",
      country: general?.location?.country || "",
    },
    instructions: general?.instructions || "",
    weather_provider: general?.weather_provider || "open_meteo",
    weather_timeout_seconds:
      typeof general?.weather_timeout_seconds === "number"
        ? general.weather_timeout_seconds
        : 8,
  };
};

export const normalizeStationDraft = (
  station: AIRadioStation,
): AIRadioStationDraft => {
  const draft = deepClone(station);
  draft.id = String(draft.id || "").trim();
  draft.name = String(draft.name || "").trim();
  draft.source_playlist_id = String(draft.source_playlist_id || "").trim();
  draft.source_playlist_provider =
    String(draft.source_playlist_provider || "library").trim() || "library";
  draft.target_playlist_provider =
    String(draft.target_playlist_provider || "builtin").trim() || "builtin";
  draft.default_player_id = String(draft.default_player_id || "").trim();
  draft.max_duration_minutes = parseOptionalNumber(draft.max_duration_minutes);
  draft.dynamic_batch_size = safeInteger(
    String(draft.dynamic_batch_size ?? 1),
    1,
    1,
  );
  draft.dynamic_poll_seconds = safeInteger(
    String(draft.dynamic_poll_seconds ?? 5),
    1,
    5,
  );
  draft.dynamic_prefetch_remaining_tracks = safeInteger(
    String(draft.dynamic_prefetch_remaining_tracks ?? 2),
    1,
    2,
  );
  draft.clear_queue_on_start = draft.clear_queue_on_start !== false;
  draft.merge_section_id = String(draft.merge_section_id || "").trim();
  draft.section_ids = Array.isArray(draft.section_ids)
    ? [...draft.section_ids]
    : [];
  draft.section_order = Array.isArray(draft.section_order)
    ? deepClone(draft.section_order)
    : [];
  draft.sections = [];
  draft.general = asGeneralDefaults(draft.general);
  return draft as AIRadioStationDraft;
};

export const normalizeSectionDraft = (
  section: AIRadioSection,
): AIRadioSection => {
  const draft = deepClone(section);
  draft.id = String(draft.id || "").trim();
  draft.name = String(draft.name || "").trim();
  draft.type = draft.type === "ai_meta" ? "ai_meta" : "ai_text";
  draft.prompt = String(draft.prompt || "");
  draft.web_search = draft.web_search || "disabled";
  draft.constraints = {
    max_chars: safeInteger(String(draft.constraints?.max_chars ?? 0), 0, 0),
  };
  return draft;
};

export const getFlowType = (item: AIRadioFlowItem): AIRadioFlowType => {
  if ("MUST" in item) {
    return "MUST";
  }
  if ("ALTERNATIVE" in item) {
    return "ALTERNATIVE";
  }
  return "OPTIONAL";
};

export const makeDefaultFlowItem = (type: AIRadioFlowType): AIRadioFlowItem => {
  if (type === "MUST") {
    return { MUST: "" };
  }
  if (type === "ALTERNATIVE") {
    return {
      ALTERNATIVE: {
        choices: [{ section: "", weight: 1 }],
      },
    };
  }
  return {
    OPTIONAL: {
      section: "",
      chance: 0.5,
      guards: {
        min_gap_songs: 0,
        max_per_60min: 0,
        require_placeholders_present: [],
      },
    },
  };
};

export const getMustSection = (item: AIRadioFlowItem): string => {
  if ("MUST" in item) {
    return item.MUST;
  }
  return "";
};

export const getAlternativeChoices = (
  item: AIRadioFlowItem,
): AIRadioAlternativeChoice[] => {
  if ("ALTERNATIVE" in item) {
    return item.ALTERNATIVE.choices;
  }
  return [];
};

export const getOptionalPayload = (
  item: AIRadioFlowItem,
): {
  section: string;
  chance?: number;
  guards?: AIRadioOptionalGuards;
} | null => {
  if ("OPTIONAL" in item) {
    if (!item.OPTIONAL.guards) {
      item.OPTIONAL.guards = {
        min_gap_songs: 0,
        max_per_60min: 0,
        require_placeholders_present: [],
      };
    }
    return item.OPTIONAL;
  }
  return null;
};

export const getOptionalSection = (item: AIRadioFlowItem): string => {
  const optional = getOptionalPayload(item);
  return optional?.section || "";
};

export const getOptionalChancePercent = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return Math.round((optional?.chance ?? 0) * 100);
};

export const getOptionalMinGap = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return safeInteger(String(optional?.guards?.min_gap_songs ?? 0), 0, 0);
};

export const getOptionalMaxPer60 = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return safeInteger(String(optional?.guards?.max_per_60min ?? 0), 0, 0);
};

export const getOptionalPlaceholders = (item: AIRadioFlowItem): string => {
  const optional = getOptionalPayload(item);
  return (optional?.guards?.require_placeholders_present || []).join(", ");
};

export const defaultGuidedPlacement = (
  section: AIRadioSection,
): AIRadioPlacement => {
  const label = `${section.id} ${section.name}`.toLowerCase();
  // Check end-of-playlist markers first because section names like
  // "Song_Introduction_End" otherwise match the loose "intro" substring below.
  // Covers English and German markers, matching the app's supported locales.
  if (
    label.includes("outro") ||
    /(^|[\s_-])(end|ende)([\s_-]|$)/.test(label) ||
    label.includes("closing") ||
    label.includes("signoff") ||
    label.includes("sign-off") ||
    label.includes("schluss") ||
    label.includes("abschluss") ||
    label.includes("verabschiedung")
  ) {
    return "end_of_playlist";
  }
  if (
    /(^|[\s_-])intro([\s_-]|$)/.test(label) ||
    label.includes("start") ||
    label.includes("opening") ||
    label.includes("anfang") ||
    label.includes("beginn") ||
    label.includes("begrüßung") ||
    label.includes("begruessung") ||
    label.includes("eröffnung") ||
    label.includes("eroeffnung")
  ) {
    return "start_of_playlist";
  }
  return "between_songs";
};

export const validateStationDraftLocal = (
  station: AIRadioStation,
): string | null => {
  if (!station.name.trim()) {
    return $t("providers.ai_radio.validation.station_name_required");
  }
  if (!station.source_playlist_id.trim()) {
    return $t("providers.ai_radio.validation.station_source_playlist_required");
  }
  if (!station.section_ids?.length) {
    return $t("providers.ai_radio.validation.select_section");
  }
  if (!station.section_order?.length) {
    return $t("providers.ai_radio.validation.section_order_required");
  }

  for (const [ruleIndex, rule] of station.section_order.entries()) {
    if (!Array.isArray(rule.flow) || !rule.flow.length) {
      return $t("providers.ai_radio.validation.rule_requires_flow", [
        ruleIndex + 1,
      ]);
    }
    for (const [flowIndex, item] of rule.flow.entries()) {
      const type = getFlowType(item);
      if (type === "MUST" && !getMustSection(item)) {
        return $t("providers.ai_radio.validation.must_needs_section", [
          ruleIndex + 1,
          flowIndex + 1,
        ]);
      }
      if (type === "ALTERNATIVE") {
        const choices = getAlternativeChoices(item).filter(
          (choice) =>
            choice.section.trim() && parseOptionalNumber(choice.weight) > 0,
        );
        if (!choices.length) {
          return $t("providers.ai_radio.validation.alternative_needs_choice", [
            ruleIndex + 1,
            flowIndex + 1,
          ]);
        }
      }
      if (type === "OPTIONAL" && !getOptionalSection(item)) {
        return $t("providers.ai_radio.validation.optional_needs_section", [
          ruleIndex + 1,
          flowIndex + 1,
        ]);
      }
      if (type === "OPTIONAL" && "OPTIONAL" in item) {
        const chance = (item.OPTIONAL as { chance?: unknown }).chance;
        if (
          chance !== undefined &&
          (typeof chance !== "number" || !Number.isFinite(chance))
        ) {
          return $t("providers.ai_radio.validation.optional_chance_numeric", [
            ruleIndex + 1,
            flowIndex + 1,
          ]);
        }
      }
    }
  }

  return null;
};

export const buildStationPayload = (
  draft: AIRadioStationDraft,
): AIRadioStation => {
  const station = normalizeStationDraft(deepClone(draft));
  if (!station.id.trim()) {
    station.id = slugify(station.name);
  }
  // Keep station payload section-id based; shared section library is edited separately.
  delete (station as { sections?: AIRadioSection[] }).sections;
  return station;
};
