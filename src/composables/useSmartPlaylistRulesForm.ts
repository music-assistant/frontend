import api from "@/plugins/api";
import type { SmartPlaylistRules } from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { useDebounceFn } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { useSmartPlaylistGenres } from "./useSmartPlaylistGenres";
import {
  SEED_MAX,
  useSmartPlaylistSeedItems,
  type SeedKind,
} from "./useSmartPlaylistSeedItems";

export type SmartPlaylistMode = "library" | "seed";
export type RuleField =
  | "genre"
  | "artist"
  | "album"
  | "album_type"
  | "favorite"
  | "year";

// Stable numeric id ↔ string value mapping for album types.
// These ids are UI-only and are never persisted; the API receives the string value.
const ALBUM_TYPE_ID_TO_VALUE: Record<number, string> = {
  1: "album",
  2: "single",
  3: "ep",
  4: "live",
  5: "soundtrack",
  6: "compilation",
};
const ALBUM_TYPE_VALUE_TO_ID: Record<string, number> = Object.fromEntries(
  Object.entries(ALBUM_TYPE_ID_TO_VALUE).map(([k, v]) => [v, Number(k)]),
);
export type RuleOperator = "is" | "is_not";

export interface RuleValue {
  id: number;
  name: string;
}

export interface RuleRow {
  uid: string;
  field: RuleField;
  operator: RuleOperator;
  values: RuleValue[];
  yearFrom?: number;
  yearTo?: number;
}

export interface SmartPlaylistRulesFormInit {
  initialRules?: SmartPlaylistRules | null;
  initialArtistItems?: RuleValue[];
  initialAlbumItems?: RuleValue[];
  initialExcludedArtistItems?: RuleValue[];
  initialExcludedAlbumItems?: RuleValue[];
}

export type TrackCountUpdateHandler = (
  count: number | null,
  duration: number | null,
  counting: boolean,
) => void;

const DEFAULT_LIMIT = 100;

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `rule-${uidCounter}`;
}

function newRule(field: RuleField, operator: RuleOperator = "is"): RuleRow {
  return { uid: nextUid(), field, operator, values: [] };
}

export function useSmartPlaylistRulesForm(
  props: SmartPlaylistRulesFormInit,
  onTrackCountUpdate: TrackCountUpdateHandler,
) {
  const mode = ref<SmartPlaylistMode>("library");
  const logic = ref<"AND" | "OR">("AND");
  const dedupHours = ref<number | undefined>(undefined);

  const libraryRules = ref<RuleRow[]>([]);
  const seedRules = ref<RuleRow[]>([]);

  const rules = computed<RuleRow[]>({
    get: () => (mode.value === "seed" ? seedRules.value : libraryRules.value),
    set: (next: RuleRow[]) => {
      if (mode.value === "seed") seedRules.value = next;
      else libraryRules.value = next;
    },
  });

  const genresComposable = useSmartPlaylistGenres();
  const seedItems = useSmartPlaylistSeedItems();

  function setMode(next: SmartPlaylistMode) {
    if (next === mode.value) return;
    if (next === "library") {
      seedItems.clearSeeds();
    }
    mode.value = next;
  }

  function addRule(field: RuleField) {
    const list = rules.value;
    if (field === "year") {
      const row = newRule("year", "is");
      row.yearFrom = undefined;
      row.yearTo = undefined;
      list.push(row);
    } else if (field === "favorite") {
      list.push(newRule("favorite", "is"));
    } else {
      list.push(newRule(field));
    }
  }

  function removeRule(uid: string) {
    rules.value = rules.value.filter((r) => r.uid !== uid);
  }

  function fieldAlreadyUsed(field: RuleField): boolean {
    if (field === "favorite" || field === "year") {
      return rules.value.some((r) => r.field === field);
    }
    return false;
  }

  const trackCountRequestId = ref(0);

  const _updateTrackCount = useDebounceFn(async () => {
    const requestId = ++trackCountRequestId.value;

    if (mode.value === "seed") {
      // Backend doesn't currently expose a "count via streaming similar" query.
      // Show an estimate based on the limit instead (handled in the display component).
      if (requestId === trackCountRequestId.value) {
        onTrackCountUpdate(null, null, false);
      }
      return;
    }

    if (requestId === trackCountRequestId.value) {
      onTrackCountUpdate(null, null, true);
    }

    try {
      const finalRules: SmartPlaylistRules = {
        ...buildFinalRules(),
        seed_track_uris: undefined,
        seed_artist_uris: undefined,
        seed_album_uris: undefined,
        seed_playlist_uris: undefined,
        seed_names: undefined,
      };
      const stats = await api.countSmartPlaylistTracks(finalRules);
      if (requestId === trackCountRequestId.value) {
        onTrackCountUpdate(stats.count, stats.duration_seconds, false);
      }
    } catch {
      if (requestId === trackCountRequestId.value) {
        onTrackCountUpdate(null, null, false);
      }
    }
  }, 600);

  watch(
    [libraryRules, seedRules, mode, logic, dedupHours, seedItems.seeds],
    () => {
      _updateTrackCount();
    },
    { deep: true },
  );

  _updateTrackCount();

  watch(
    () => props.initialRules,
    async (initial) => {
      if (!initial) return;

      const seedEntries: { uri: string; kind: SeedKind }[] = [
        ...(initial.seed_track_uris ?? []).map((uri) => ({
          uri,
          kind: "track" as SeedKind,
        })),
        ...(initial.seed_artist_uris ?? []).map((uri) => ({
          uri,
          kind: "artist" as SeedKind,
        })),
        ...(initial.seed_album_uris ?? []).map((uri) => ({
          uri,
          kind: "album" as SeedKind,
        })),
        ...(initial.seed_playlist_uris ?? []).map((uri) => ({
          uri,
          kind: "playlist" as SeedKind,
        })),
      ];
      const isSeed = seedEntries.length > 0;
      mode.value = isSeed ? "seed" : "library";
      logic.value = initial.logic ?? "AND";
      dedupHours.value = initial.dedup_hours ?? undefined;

      const fresh: RuleRow[] = [];

      if (initial.genre_ids?.length) {
        const row = newRule("genre", "is");
        row.values = initial.genre_ids.map((id) => ({
          id,
          name: initial.genre_names?.[id] ?? String(id),
        }));
        fresh.push(row);
      }
      if (initial.excluded_genre_ids?.length) {
        const row = newRule("genre", "is_not");
        row.values = initial.excluded_genre_ids.map((id) => ({
          id,
          name: initial.excluded_genre_names?.[id] ?? String(id),
        }));
        fresh.push(row);
      }

      if (!isSeed) {
        if (initial.artist_ids?.length) {
          const row = newRule("artist", "is");
          row.values = (props.initialArtistItems ?? []).slice();
          if (!row.values.length) {
            row.values = initial.artist_ids.map((id) => ({
              id,
              name: initial.artist_names?.[id] ?? String(id),
            }));
          }
          fresh.push(row);
        }
        if (initial.excluded_artist_ids?.length) {
          const row = newRule("artist", "is_not");
          row.values = (props.initialExcludedArtistItems ?? []).slice();
          if (!row.values.length) {
            row.values = initial.excluded_artist_ids.map((id) => ({
              id,
              name: initial.excluded_artist_names?.[id] ?? String(id),
            }));
          }
          fresh.push(row);
        }
        if (initial.album_ids?.length) {
          const row = newRule("album", "is");
          row.values = (props.initialAlbumItems ?? []).slice();
          if (!row.values.length) {
            row.values = initial.album_ids.map((id) => ({
              id,
              name: initial.album_names?.[id] ?? String(id),
            }));
          }
          fresh.push(row);
        }
        if (initial.excluded_album_ids?.length) {
          const row = newRule("album", "is_not");
          row.values = (props.initialExcludedAlbumItems ?? []).slice();
          if (!row.values.length) {
            row.values = initial.excluded_album_ids.map((id) => ({
              id,
              name: initial.excluded_album_names?.[id] ?? String(id),
            }));
          }
          fresh.push(row);
        }
        if (initial.favorites_only) {
          fresh.push(newRule("favorite", "is"));
        }
      }

      const yearFrom =
        typeof initial.year_from === "number" && initial.year_from > 0
          ? initial.year_from
          : undefined;
      const yearTo =
        typeof initial.year_to === "number" && initial.year_to > 0
          ? initial.year_to
          : undefined;
      if (yearFrom !== undefined || yearTo !== undefined) {
        const row = newRule("year", "is");
        row.yearFrom = yearFrom;
        row.yearTo = yearTo;
        fresh.push(row);
      }

      if (initial.album_types?.length) {
        const row = newRule("album_type", "is");
        row.values = initial.album_types
          .filter((at) => ALBUM_TYPE_VALUE_TO_ID[at] !== undefined)
          .map((at) => ({
            id: ALBUM_TYPE_VALUE_TO_ID[at],
            name: $t(`album_type.${at}`),
          }));
        if (row.values.length) fresh.push(row);
      }
      if (initial.excluded_album_types?.length) {
        const row = newRule("album_type", "is_not");
        row.values = initial.excluded_album_types
          .filter((at) => ALBUM_TYPE_VALUE_TO_ID[at] !== undefined)
          .map((at) => ({
            id: ALBUM_TYPE_VALUE_TO_ID[at],
            name: $t(`album_type.${at}`),
          }));
        if (row.values.length) fresh.push(row);
      }

      rules.value = fresh;

      seedItems.clearSeeds();
      if (isSeed) {
        seedItems.loadSeedsFromUris(seedEntries, initial.seed_names);
        // Hydrate display info (subtitles) where possible from the live items.
        // The cap is 10 seeds so this is bounded.
        await Promise.all(
          seedEntries.map(async ({ uri }, idx) => {
            try {
              const item = await api.getItemByUri(uri);
              const current = seedItems.seeds.value[idx];
              if (!current || current.uri !== uri) return;
              const next = { ...current, name: item.name };
              if (item.media_type === MediaType.TRACK) {
                const firstArtist = (item as { artists?: { name: string }[] })
                  .artists?.[0]?.name;
                if (firstArtist) next.subtitle = firstArtist;
              } else if (item.media_type === MediaType.ALBUM) {
                const firstArtist = (item as { artists?: { name: string }[] })
                  .artists?.[0]?.name;
                if (firstArtist) next.subtitle = firstArtist;
              }
              const list = seedItems.seeds.value.slice();
              list[idx] = next;
              seedItems.seeds.value = list;
            } catch {
              // unresolved seed — keep the URI as a placeholder name
            }
          }),
        );
      }

      await nextTick();
      initialSnapshot.value = JSON.stringify(buildFinalRules());
    },
    { immediate: true },
  );

  function pickRuleValues(field: RuleField, op: RuleOperator): RuleValue[] {
    const list: RuleValue[] = [];
    for (const r of rules.value) {
      if (r.field === field && r.operator === op) {
        for (const v of r.values) {
          if (!list.some((x) => x.id === v.id)) list.push(v);
        }
      }
    }
    return list;
  }

  function yearRule(): RuleRow | undefined {
    return rules.value.find((r) => r.field === "year");
  }

  function favoriteRule(): RuleRow | undefined {
    return rules.value.find((r) => r.field === "favorite");
  }

  function buildFinalRules(): SmartPlaylistRules {
    const isSeed = mode.value === "seed";

    const genreInclude = pickRuleValues("genre", "is");
    const genreExclude = pickRuleValues("genre", "is_not");
    const artistInclude = isSeed ? [] : pickRuleValues("artist", "is");
    const artistExclude = isSeed ? [] : pickRuleValues("artist", "is_not");
    const albumInclude = isSeed ? [] : pickRuleValues("album", "is");
    const albumExclude = isSeed ? [] : pickRuleValues("album", "is_not");
    const albumTypeInclude = pickRuleValues("album_type", "is");
    const albumTypeExclude = pickRuleValues("album_type", "is_not");
    const yr = yearRule();
    const fav = !isSeed && !!favoriteRule();

    const final: SmartPlaylistRules = {
      genre_ids: genreInclude.map((v) => v.id),
      artist_ids: artistInclude.map((v) => v.id),
      album_ids: albumInclude.map((v) => v.id),
      favorites_only: fav,
      excluded_genre_ids: genreExclude.map((v) => v.id),
      excluded_artist_ids: artistExclude.map((v) => v.id),
      excluded_album_ids: albumExclude.map((v) => v.id),
      excluded_track_uris: [],
      genre_names: Object.fromEntries(genreInclude.map((v) => [v.id, v.name])),
      artist_names: Object.fromEntries(
        artistInclude.map((v) => [v.id, v.name]),
      ),
      album_names: Object.fromEntries(albumInclude.map((v) => [v.id, v.name])),
      excluded_genre_names: Object.fromEntries(
        genreExclude.map((v) => [v.id, v.name]),
      ),
      excluded_artist_names: Object.fromEntries(
        artistExclude.map((v) => [v.id, v.name]),
      ),
      excluded_album_names: Object.fromEntries(
        albumExclude.map((v) => [v.id, v.name]),
      ),
      logic: isSeed ? "AND" : logic.value,
      limit: DEFAULT_LIMIT,
      year_from: yr?.yearFrom ?? undefined,
      year_to: yr?.yearTo ?? undefined,
      dedup_hours: dedupHours.value,
      album_types: albumTypeInclude
        .map((v) => ALBUM_TYPE_ID_TO_VALUE[v.id as number])
        .filter((x): x is string => !!x),
      excluded_album_types: albumTypeExclude
        .map((v) => ALBUM_TYPE_ID_TO_VALUE[v.id as number])
        .filter((x): x is string => !!x),
    };

    if (isSeed) {
      const trackUris: string[] = [];
      const artistUris: string[] = [];
      const albumUris: string[] = [];
      const playlistUris: string[] = [];
      const names: Record<string, string> = {};
      for (const s of seedItems.seeds.value) {
        if (s.kind === "track") trackUris.push(s.uri);
        else if (s.kind === "artist") artistUris.push(s.uri);
        else if (s.kind === "album") albumUris.push(s.uri);
        else playlistUris.push(s.uri);
        names[s.uri] = s.subtitle ? `${s.name} – ${s.subtitle}` : s.name;
      }
      final.seed_track_uris = trackUris;
      final.seed_artist_uris = artistUris;
      final.seed_album_uris = albumUris;
      final.seed_playlist_uris = playlistUris;
      final.seed_names = names;
    }

    return final;
  }

  function getFinalRules(): SmartPlaylistRules {
    return buildFinalRules();
  }

  const availableFields = computed<RuleField[]>(() => {
    if (mode.value === "seed") {
      return (["genre", "album_type", "year"] as RuleField[]).filter(
        (f) => !fieldAlreadyUsed(f),
      );
    }
    return (
      ["genre", "album_type", "artist", "album", "favorite", "year"] as RuleField[]
    ).filter((f) => !fieldAlreadyUsed(f));
  });

  const albumTypeOptions = computed(() =>
    Object.entries(ALBUM_TYPE_ID_TO_VALUE).map(([idStr, value]) => ({
      id: Number(idStr),
      name: $t(`album_type.${value}`),
    })),
  );

  const initialSnapshot = ref<string | null>(null);
  const hasChanges = computed(() => {
    if (initialSnapshot.value === null) return true;
    return JSON.stringify(buildFinalRules()) !== initialSnapshot.value;
  });

  const invalidRuleUids = ref<Set<string>>(new Set());
  const seedInvalid = ref(false);

  function ruleIsEmpty(r: RuleRow): boolean {
    if (r.field === "year")
      return r.yearFrom === undefined && r.yearTo === undefined;
    if (r.field === "favorite") return false;
    return r.values.length === 0;
  }

  function validate(): string[] {
    const errors: string[] = [];
    const invalid = new Set<string>();

    if (mode.value === "seed") {
      if (!seedItems.hasSeed.value) {
        errors.push(
          "Pick at least one track, artist, album, or playlist to seed the playlist from.",
        );
        seedInvalid.value = true;
      } else if (seedItems.seeds.value.length > SEED_MAX) {
        errors.push(`A smart playlist accepts up to ${SEED_MAX} seeds.`);
        seedInvalid.value = true;
      } else {
        seedInvalid.value = false;
      }
    } else {
      seedInvalid.value = false;
    }

    rules.value = rules.value.filter((r) => !ruleIsEmpty(r));

    for (const r of rules.value) {
      if (
        r.field === "year" &&
        r.yearFrom !== undefined &&
        r.yearTo !== undefined &&
        r.yearFrom > r.yearTo
      ) {
        invalid.add(r.uid);
        errors.push("Year 'from' must be ≤ 'to'.");
      }
    }

    invalidRuleUids.value = invalid;
    return errors;
  }

  function clearRuleValidation(uid: string) {
    if (invalidRuleUids.value.has(uid)) {
      const next = new Set(invalidRuleUids.value);
      next.delete(uid);
      invalidRuleUids.value = next;
    }
  }

  function clearSeedValidation() {
    if (seedInvalid.value) seedInvalid.value = false;
  }

  watch(
    seedItems.seeds,
    (seeds) => {
      if (seeds.length > 0) clearSeedValidation();
    },
    { deep: true },
  );

  return {
    mode,
    logic,
    dedupHours,
    rules,
    invalidRuleUids,
    seedInvalid,
    hasChanges,
    genres: genresComposable.genres,
    genreOptions: genresComposable.genreOptions,
    genreName: genresComposable.genreName,
    albumTypeOptions,
    seedItems,
    setMode,
    addRule,
    removeRule,
    availableFields,
    getFinalRules,
    validate,
    clearRuleValidation,
    clearSeedValidation,
  };
}

export type SmartPlaylistRulesFormContext = ReturnType<
  typeof useSmartPlaylistRulesForm
>;
