<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <component
        :is="isSeed ? Sparkles : Library"
        class="h-4 w-4 text-primary"
      />
      <span class="text-sm font-medium">
        {{
          isSeed
            ? $t("smart_playlist.type_seed")
            : $t("smart_playlist.type_library")
        }}
      </span>
    </div>

    <div
      v-if="seedLabels.length"
      class="rounded-md border bg-card px-3 py-2 flex flex-col gap-1"
    >
      <span class="text-xs text-muted-foreground uppercase tracking-wide">
        {{ $t("smart_playlist.seed_heading") }}
      </span>
      <div class="flex flex-wrap gap-1">
        <Badge
          v-for="(label, i) in seedLabels"
          :key="i"
          variant="default"
          class="text-xs"
        >
          {{ label }}
        </Badge>
      </div>
    </div>

    <div v-if="!isSeed && hasAnyInclude" class="text-xs text-muted-foreground">
      <span>{{ $t("smart_playlist.match") }}</span>
      <span class="font-medium text-foreground mx-1">
        {{
          rules.logic === "OR"
            ? $t("smart_playlist.match_any")
            : $t("smart_playlist.match_all")
        }}
      </span>
      <span>{{ $t("smart_playlist.match_following") }}</span>
    </div>

    <div v-if="ruleRows.length" class="flex flex-col gap-1.5">
      <div
        v-for="row in ruleRows"
        :key="row.key"
        class="flex items-start gap-2 rounded-md border bg-card/40 px-3 py-2"
      >
        <component
          :is="row.icon"
          class="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0"
        />
        <div class="flex flex-col gap-1 min-w-0">
          <span class="text-xs uppercase tracking-wide text-muted-foreground">
            {{ row.label }}
          </span>
          <div v-if="row.tags" class="flex flex-wrap gap-1">
            <Badge
              v-for="(t, i) in row.tags"
              :key="i"
              :variant="row.exclude ? 'outline' : 'default'"
              class="text-xs"
            >
              {{ t }}
            </Badge>
          </div>
          <span v-else class="text-sm">{{ row.value }}</span>
        </div>
      </div>
    </div>
    <div
      v-else-if="!seedLabels.length"
      class="rounded-md border bg-card/40 px-3 py-3 flex items-start gap-2"
    >
      <Library class="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-sm font-medium">
          {{ $t("smart_playlist.no_rules_title") }}
        </span>
        <span class="text-xs text-muted-foreground leading-relaxed">
          {{ $t("smart_playlist.no_rules_desc") }}
        </span>
      </div>
    </div>

    <div
      v-if="rules.dedup_hours"
      class="text-xs text-muted-foreground flex items-center gap-1.5 pt-1"
    >
      <Timer class="h-3.5 w-3.5" />
      <span>
        {{ $t("smart_playlist.dedup_hours") }}
        <span class="font-medium text-foreground ml-1">
          {{ rules.dedup_hours }}h
        </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import type { SmartPlaylistRules } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Ban, Library, Sparkles, Timer } from "@lucide/vue";
import { computed, type Component } from "vue";
import { fieldIcon } from "./fieldIcon";

interface RuleViewRow {
  key: string;
  icon: Component;
  label: string;
  exclude: boolean;
  tags?: string[];
  value?: string;
}

const props = defineProps<{
  rules: SmartPlaylistRules;
}>();

const allSeedUris = computed<string[]>(() => [
  ...(props.rules.seed_track_uris ?? []),
  ...(props.rules.seed_artist_uris ?? []),
  ...(props.rules.seed_album_uris ?? []),
  ...(props.rules.seed_playlist_uris ?? []),
]);

const isSeed = computed(() => allSeedUris.value.length > 0);

const seedLabels = computed<string[]>(() =>
  allSeedUris.value.map((uri) => props.rules.seed_names?.[uri] ?? uri),
);

function namesFor(
  ids: number[] | undefined,
  names: Record<number, string> | undefined,
): string[] {
  if (!ids?.length) return [];
  return ids.map((id) => names?.[id] ?? String(id));
}

const hasAnyInclude = computed(() => {
  const r = props.rules;
  return (
    !!r.genre_ids?.length ||
    !!r.artist_ids?.length ||
    !!r.album_ids?.length ||
    !!r.album_types?.length ||
    !!r.favorites_only ||
    r.explicit !== undefined
  );
});

const ruleRows = computed<RuleViewRow[]>(() => {
  const r = props.rules;
  const rows: RuleViewRow[] = [];

  const genreNames = namesFor(r.genre_ids, r.genre_names);
  if (genreNames.length) {
    rows.push({
      key: "genre-is",
      icon: fieldIcon("genre"),
      label: $t("smart_playlist.field_genre_is"),
      exclude: false,
      tags: genreNames,
    });
  }
  const exGenreNames = namesFor(r.excluded_genre_ids, r.excluded_genre_names);
  if (exGenreNames.length) {
    rows.push({
      key: "genre-not",
      icon: Ban,
      label: $t("smart_playlist.field_genre_is_not"),
      exclude: true,
      tags: exGenreNames,
    });
  }

  const artistNames = namesFor(r.artist_ids, r.artist_names);
  if (artistNames.length) {
    rows.push({
      key: "artist-is",
      icon: fieldIcon("artist"),
      label: $t("smart_playlist.field_artist_is"),
      exclude: false,
      tags: artistNames,
    });
  }
  const exArtistNames = namesFor(
    r.excluded_artist_ids,
    r.excluded_artist_names,
  );
  if (exArtistNames.length) {
    rows.push({
      key: "artist-not",
      icon: Ban,
      label: $t("smart_playlist.field_artist_is_not"),
      exclude: true,
      tags: exArtistNames,
    });
  }

  const albumNames = namesFor(r.album_ids, r.album_names);
  if (albumNames.length) {
    rows.push({
      key: "album-is",
      icon: fieldIcon("album"),
      label: $t("smart_playlist.field_album_is"),
      exclude: false,
      tags: albumNames,
    });
  }
  const exAlbumNames = namesFor(r.excluded_album_ids, r.excluded_album_names);
  if (exAlbumNames.length) {
    rows.push({
      key: "album-not",
      icon: Ban,
      label: $t("smart_playlist.field_album_is_not"),
      exclude: true,
      tags: exAlbumNames,
    });
  }

  if (r.favorites_only) {
    rows.push({
      key: "favorite",
      icon: fieldIcon("favorite"),
      label: $t("smart_playlist.field_favorite"),
      exclude: false,
      value: $t("smart_playlist.favorites_yes"),
    });
  }

  const albumTypeNames = (r.album_types ?? []).map((at) =>
    $t(`album_type.${at}`),
  );
  if (albumTypeNames.length) {
    rows.push({
      key: "album-type-is",
      icon: fieldIcon("album_type"),
      label: $t("smart_playlist.field_album_type_is"),
      exclude: false,
      tags: albumTypeNames,
    });
  }
  const exAlbumTypeNames = (r.excluded_album_types ?? []).map((at) =>
    $t(`album_type.${at}`),
  );
  if (exAlbumTypeNames.length) {
    rows.push({
      key: "album-type-not",
      icon: Ban,
      label: $t("smart_playlist.field_album_type_is_not"),
      exclude: true,
      tags: exAlbumTypeNames,
    });
  }

  if (r.explicit === null) {
    rows.push({
      key: "explicit-allowed",
      icon: fieldIcon("explicit"),
      label: $t("smart_playlist.field_explicit"),
      exclude: false,
      value: $t("smart_playlist.explicit_allowed"),
    });
  } else if (r.explicit === true) {
    rows.push({
      key: "explicit-is",
      icon: fieldIcon("explicit"),
      label: $t("smart_playlist.field_explicit"),
      exclude: false,
      value: $t("smart_playlist.explicit_only"),
    });
  } else if (r.explicit === false) {
    rows.push({
      key: "explicit-not",
      icon: fieldIcon("explicit"),
      label: $t("smart_playlist.field_explicit"),
      exclude: true,
      value: $t("smart_playlist.explicit_not_allowed"),
    });
  }

  const yf = r.year_from;
  const yt = r.year_to;
  if (
    (typeof yf === "number" && yf > 0) ||
    (typeof yt === "number" && yt > 0)
  ) {
    let v: string;
    if (yf && yt) v = `${yf} – ${yt}`;
    else if (yf) v = `≥ ${yf}`;
    else v = `≤ ${yt}`;
    rows.push({
      key: "year",
      icon: fieldIcon("year"),
      label: $t("smart_playlist.field_year"),
      exclude: false,
      value: v,
    });
  }

  return rows;
});
</script>
