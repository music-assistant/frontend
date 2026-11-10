<template>
  <section class="flex flex-col gap-3" :aria-busy="loading">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-medium">{{ headerText }}</h2>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-sm">
          <Switch
            :model-value="includeRemoved"
            @update:model-value="emit('update:includeRemoved', $event === true)"
          />
          {{ $t("rotation.preview.show_removed") }}
        </label>
        <Button variant="outline" size="sm" @click="emit('reshuffle')">
          <Shuffle class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {{ $t("rotation.preview.shuffle") }}
        </Button>
      </div>
    </header>

    <div v-if="loading && !groups.length" class="flex flex-col gap-3">
      <div v-for="n in SKELETON_GROUPS" :key="n" class="flex flex-col gap-2">
        <Skeleton class="h-10 w-2/3" />
        <Skeleton class="h-5 w-full" />
        <Skeleton class="h-5 w-full" />
      </div>
    </div>

    <Empty v-else-if="!groups.length" class="border-none">
      <EmptyMedia variant="icon">
        <Music2 class="h-5 w-5" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{{ $t("rotation.preview.empty_title") }}</EmptyTitle>
        <EmptyDescription>
          {{ emptyText }}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>

    <div v-else :class="cn('flex flex-col gap-4', loading && 'opacity-60')">
      <div v-for="(group, gi) in groups" :key="gi" class="flex flex-col gap-1">
        <div v-if="group.item" class="flex items-center gap-3">
          <div class="size-10 shrink-0 overflow-hidden rounded">
            <MediaItemThumb :item="group.item" :size="40" />
          </div>
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-sm font-medium">
              {{ withVersion(group.item) }}
            </span>
            <span
              v-if="artistsOf(group.item)"
              data-testid="rotation-preview-artists"
              class="truncate text-sm text-muted-foreground"
            >
              {{ artistsOf(group.item) }}
            </span>
          </div>
        </div>
        <ol class="flex flex-col">
          <li
            v-for="row in group.rows"
            :key="row.key"
            :class="
              cn(
                'flex items-center gap-3 py-1 pl-1 text-sm',
                row.removed && 'text-muted-foreground line-through',
              )
            "
          >
            <span
              class="w-6 shrink-0 text-right tabular-nums text-muted-foreground"
            >
              {{ row.number }}
            </span>
            <div
              v-if="row.track"
              class="size-10 shrink-0 overflow-hidden rounded-sm"
            >
              <MediaItemThumb :item="row.track" :size="40" />
            </div>
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate">{{ row.title }}</span>
              <span
                v-if="row.artists"
                data-testid="rotation-preview-track-artists"
                class="truncate text-muted-foreground"
              >
                {{ row.artists }}
              </span>
            </div>
            <span
              v-if="row.duration"
              data-testid="rotation-preview-duration"
              class="shrink-0 tabular-nums text-muted-foreground"
            >
              {{ row.duration }}
            </span>
          </li>
        </ol>
      </div>
    </div>

    <Button
      v-if="canShowMore"
      variant="ghost"
      size="sm"
      class="self-start"
      @click="emit('more')"
    >
      {{ $t("rotation.preview.show_more") }}
    </Button>

    <p class="text-xs text-muted-foreground">
      {{ $t("rotation.preview.note") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Music2, Shuffle } from "@lucide/vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PREVIEW_LIMIT_MAX } from "@/composables/rotation/useRotationEditor";
import { formatDuration, getArtistsString } from "@/helpers/utils";
import { cn } from "@/lib/utils";
import {
  MediaType,
  type MediaItemType,
  type RotationPreview,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

const SKELETON_GROUPS = 3;
const REMOVED_MARK = "-";

interface Props {
  preview: RotationPreview | null;
  loading: boolean;
  includeRemoved: boolean;
  limit: number;
  // the steps have validation errors, so the server builds no preview
  hasErrors?: boolean;
}

interface PreviewRow {
  key: string;
  number: string;
  title: string;
  // empty inside an album when the track has the album's artists
  artists: string;
  duration: string;
  removed: boolean;
  // set on rows of a flat track list, which show their own thumb
  track?: Track;
}

interface PreviewGroup {
  // null for a flat list of tracks, which has no header
  item: MediaItemType | null;
  rows: PreviewRow[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:includeRemoved": [value: boolean];
  more: [];
  reshuffle: [];
}>();

// the same "Name (version)" the other lists show, so remixes and editions tell apart
function withVersion(item: { name: string; version?: string }): string {
  return item.version ? `${item.name} (${item.version})` : item.name;
}

function artistsOf(item: MediaItemType): string {
  return "artists" in item && item.artists
    ? getArtistsString(item.artists)
    : "";
}

const groups = computed<PreviewGroup[]>(() => {
  let position = 0;
  const result: PreviewGroup[] = [];
  (props.preview?.groups ?? []).forEach((group, gi) => {
    // a track unit is its own only track, so it joins one flat list
    const flat = group.item.media_type === MediaType.TRACK;
    const rows: PreviewRow[] = [];
    const albumArtists = artistsOf(group.item);
    group.tracks.forEach((entry, ti) => {
      if (entry.removed && !props.includeRemoved) return;
      if (!entry.removed) position += 1;
      const trackArtists = artistsOf(entry.track);
      rows.push({
        key: `${gi}-${ti}`,
        number: entry.removed ? REMOVED_MARK : String(position),
        title: withVersion(entry.track),
        artists: flat || trackArtists !== albumArtists ? trackArtists : "",
        duration: entry.track.duration
          ? formatDuration(entry.track.duration)
          : "",
        removed: entry.removed,
        track: flat ? entry.track : undefined,
      });
    });
    if (!rows.length) return;
    const last = result.at(-1);
    if (flat && last && last.item === null) last.rows.push(...rows);
    else result.push({ item: flat ? null : group.item, rows });
  });
  return result;
});

const shownCount = computed(() =>
  (props.preview?.groups ?? []).reduce(
    (sum, group) => sum + group.tracks.filter((t) => !t.removed).length,
    0,
  ),
);

const canShowMore = computed(
  () =>
    !!props.preview &&
    shownCount.value < props.preview.total_tracks &&
    props.limit < PREVIEW_LIMIT_MAX,
);

const emptyText = computed(() =>
  $t(
    props.hasErrors
      ? "rotation.preview.empty_errors"
      : "rotation.preview.empty_desc",
  ),
);

const headerText = computed(() => {
  const total = props.preview?.total_tracks ?? 0;
  return $t(
    props.preview?.total_exact === false
      ? "rotation.preview.header_at_least"
      : "rotation.preview.header",
    {
      shown: shownCount.value,
      total,
      duration: formatDuration(props.preview?.duration_seconds ?? 0),
    },
    total,
  );
});
</script>
