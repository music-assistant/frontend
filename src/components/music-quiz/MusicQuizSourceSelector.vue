<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <Field>
      <FieldLabel :for="inputId">
        {{ $t("providers.music_quiz.add_music_sources") }}
      </FieldLabel>
      <MediaSearch
        :input-id="inputId"
        :allowed-media-types="MUSIC_QUIZ_SOURCE_MEDIA_TYPES"
        :default-selected-media-types="MUSIC_QUIZ_DEFAULT_SOURCE_MEDIA_TYPES"
        :exclude-uris="selectedSourceUris"
        :placeholder="$t('providers.music_quiz.search_music')"
        @select="onSourceSelect"
      />
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
        v-if="selectedSources.length"
        class="flex max-h-52 flex-col gap-2 overflow-y-auto overscroll-contain"
      >
        <button
          v-for="item in selectedSources"
          :key="item.uri"
          type="button"
          class="bg-muted hover:bg-accent focus-visible:ring-ring grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
          :aria-label="
            $t('providers.music_quiz.remove_music_source', [item.name])
          "
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
import MediaSearch from "@/components/MediaSearch.vue";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  isMusicQuizSourceItem,
  MUSIC_QUIZ_DEFAULT_SOURCE_MEDIA_TYPES,
  MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
  useMusicQuizSources,
  type MusicQuizSourceItem,
} from "@/composables/useMusicQuizSources";
import { musicQuizSourceTypeLabel } from "@/helpers/music_quiz_sources";
import {
  MediaType,
  type MediaItemTypeOrItemMapping,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { X } from "@lucide/vue";
import { watch } from "vue";

defineProps<{ inputId: string }>();
const sourceUris = defineModel<string[]>({ required: true });

const {
  selected: selectedSources,
  sourceUris: selectedSourceUris,
  summary: selectedSummary,
  add: addSource,
  remove: removeSource,
} = useMusicQuizSources();

watch(selectedSourceUris, (uris) => {
  sourceUris.value = uris;
});

function onSourceSelect(item: MediaItemTypeOrItemMapping) {
  if (!isMusicQuizSourceItem(item)) return;
  addSource(item);
}

function sourceSubtitle(item: MusicQuizSourceItem) {
  if (isTrack(item) && item.artists?.[0]?.name) {
    return $t("providers.music_quiz.track_with_artist", [item.artists[0].name]);
  }
  return musicQuizSourceTypeLabel(item.media_type);
}

function isTrack(item: MusicQuizSourceItem): item is Track {
  return item.media_type === MediaType.TRACK;
}
</script>
