<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <Field>
      <FieldLabel for="music-quiz-source-search">
        {{ $t("providers.music_quiz.add_tracks_or_playlists") }}
      </FieldLabel>
      <SearchInput
        id="music-quiz-source-search"
        v-model="sourceQuery"
        clearable
        :placeholder="$t('providers.music_quiz.search_music')"
      />
      <div
        v-if="sourceQuery.trim().length >= minSearchLength"
        class="bg-background max-h-72 overflow-y-auto overscroll-contain rounded-md border p-1"
      >
        <p
          v-if="sourceSearching"
          class="text-muted-foreground px-2 py-3 text-sm"
        >
          {{ $t("providers.music_quiz.searching") }}
        </p>
        <button
          v-for="item in sourceResults"
          v-else
          :key="item.uri"
          type="button"
          class="hover:bg-accent focus-visible:ring-ring grid w-full grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-md p-2 text-left focus-visible:ring-2 focus-visible:outline-none"
          @click="addSource(item)"
        >
          <MediaItemThumb :item="item" :size="44" />
          <span class="flex min-w-0 flex-col">
            <strong class="truncate">{{ item.name }}</strong>
            <small class="text-muted-foreground truncate">
              {{ sourceSubtitle(item) }}
            </small>
          </span>
        </button>
        <p
          v-if="!sourceSearching && sourceResults.length === 0"
          class="text-muted-foreground px-2 py-3 text-sm"
        >
          {{ $t("providers.music_quiz.no_sources_found") }}
        </p>
      </div>
    </Field>

    <Field>
      <FieldLabel>{{ $t("providers.music_quiz.selected_music") }}</FieldLabel>
      <div
        class="bg-background flex min-h-9 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
      >
        <span class="text-muted-foreground">
          {{ $t("providers.music_quiz.selected_music") }}
        </span>
        <Badge variant="secondary">{{ selectedSummary }}</Badge>
      </div>
      <div
        v-if="selectedSources.length > 0"
        class="flex max-h-52 flex-col gap-2 overflow-y-auto overscroll-contain"
      >
        <button
          v-for="item in selectedSources"
          :key="item.uri"
          type="button"
          class="bg-muted hover:bg-accent grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2 text-left"
          @click="removeSource(item.uri)"
        >
          <span class="flex min-w-0 flex-col">
            <strong class="truncate">{{ item.name }}</strong>
            <small class="text-muted-foreground truncate">
              {{ sourceSubtitle(item) }}
            </small>
          </span>
          <X class="text-muted-foreground size-4 shrink-0" />
        </button>
      </div>
      <p v-else class="text-muted-foreground text-sm">
        {{ $t("providers.music_quiz.pick_at_least_one_source") }}
      </p>
    </Field>
  </div>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import {
  useMusicQuizSourceSearch,
  type MusicQuizSourceItem,
} from "@/composables/useMusicQuizSourceSearch";
import { MediaType, type Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { X } from "@lucide/vue";
import { watch } from "vue";

const model = defineModel<string[]>({ required: true });

const {
  query: sourceQuery,
  results: sourceResults,
  selected: selectedSources,
  searching: sourceSearching,
  sourceUris,
  summary: selectedSummary,
  minSearchLength,
  add: addSource,
  remove: removeSource,
} = useMusicQuizSourceSearch();

watch(sourceUris, (value) => (model.value = [...value]), { immediate: true });

function sourceSubtitle(item: MusicQuizSourceItem) {
  if (item.media_type === MediaType.PLAYLIST)
    return $t("providers.music_quiz.playlist");
  const artist = isTrack(item) ? item.artists?.[0]?.name : undefined;
  return artist
    ? $t("providers.music_quiz.track_with_artist", [artist])
    : $t("providers.music_quiz.track");
}

function isTrack(item: MusicQuizSourceItem): item is Track {
  return item.media_type === MediaType.TRACK;
}
</script>
