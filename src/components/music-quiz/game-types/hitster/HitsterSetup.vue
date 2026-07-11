<template>
  <div class="flex flex-col gap-5">
    <div class="grid gap-4 sm:grid-cols-2">
      <Field class="sm:col-span-2">
        <FieldLabel for="hitster-name">
          {{ $t("providers.music_quiz.session_name") }}
        </FieldLabel>
        <Input id="hitster-name" v-model="name" />
      </Field>

      <Field>
        <FieldLabel for="hitster-rounds">
          {{ $t("providers.music_quiz.rounds") }}
        </FieldLabel>
        <NumberField
          id="hitster-rounds"
          v-model="roundCount"
          :min="MIN_ROUNDS"
          :max="MAX_ROUNDS"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </Field>

      <Field>
        <FieldLabel for="hitster-seconds">
          {{ $t("providers.music_quiz.answer_seconds") }}
        </FieldLabel>
        <NumberField
          id="hitster-seconds"
          v-model="answerDuration"
          :min="MIN_SECONDS"
          :max="MAX_SECONDS"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </Field>

      <Field>
        <FieldLabel for="hitster-artist-bonus">
          {{ $t("providers.music_quiz.timeline_artist_bonus") }}
        </FieldLabel>
        <NativeSelect
          id="hitster-artist-bonus"
          v-model="artistBonusMode"
          class="w-full"
        >
          <option
            v-for="option in bonusModeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel for="hitster-title-bonus">
          {{ $t("providers.music_quiz.timeline_title_bonus") }}
        </FieldLabel>
        <NativeSelect
          id="hitster-title-bonus"
          v-model="titleBonusMode"
          class="w-full"
        >
          <option
            v-for="option in bonusModeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </NativeSelect>
      </Field>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <Field>
        <FieldLabel for="hitster-source-search">
          {{ $t("providers.music_quiz.add_tracks_or_playlists") }}
        </FieldLabel>
        <MediaSearch
          input-id="hitster-source-search"
          :allowed-media-types="[MediaType.TRACK, MediaType.PLAYLIST]"
          :default-selected-media-types="[MediaType.PLAYLIST]"
          :exclude-uris="sourceUris"
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

    <Button size="lg" :disabled="busy || !canCreate" @click="create">
      <ListPlus class="size-4" />
      {{ $t("create") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import MediaSearch from "@/components/MediaSearch.vue";
import type {
  MusicQuizSetupAdapterEmits,
  MusicQuizSetupAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import type {
  MusicQuizHitsterConfig,
  MusicQuizTimelineBonusMode,
} from "@/composables/useMusicQuiz";
import {
  useMusicQuizSources,
  type MusicQuizSourceItem,
} from "@/composables/useMusicQuizSources";
import {
  MediaType,
  type MediaItemTypeOrItemMapping,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ListPlus, X } from "@lucide/vue";
import { computed, ref } from "vue";

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 100;
const MIN_SECONDS = 1;
const MAX_SECONDS = 300;

defineProps<MusicQuizSetupAdapterProps>();
const emit = defineEmits<MusicQuizSetupAdapterEmits>();

const name = ref("");
const roundCount = ref(5);
const answerDuration = ref(30);
const artistBonusMode = ref<MusicQuizTimelineBonusMode>("off");
const titleBonusMode = ref<MusicQuizTimelineBonusMode>("off");
const bonusModeOptions = computed(() => [
  {
    value: "off" as const,
    label: $t("providers.music_quiz.timeline_bonus_off"),
  },
  {
    value: "free_text" as const,
    label: $t("providers.music_quiz.timeline_bonus_free_text"),
  },
  {
    value: "multiple_choice" as const,
    label: $t("providers.music_quiz.timeline_bonus_multiple_choice"),
  },
]);

const {
  selected: selectedSources,
  sourceUris,
  summary: selectedSummary,
  canCreate,
  add: addSource,
  remove: removeSource,
} = useMusicQuizSources();

function onSourceSelect(item: MediaItemTypeOrItemMapping) {
  // the search is restricted to tracks and playlists
  if (
    item.media_type !== MediaType.TRACK &&
    item.media_type !== MediaType.PLAYLIST
  ) {
    return;
  }
  addSource(item as MusicQuizSourceItem);
}

function create() {
  if (!canCreate.value) return;
  const config: MusicQuizHitsterConfig = {
    round_count: roundCount.value,
    answer_duration: answerDuration.value,
    source_uris: sourceUris.value,
    artist_bonus_mode: artistBonusMode.value,
    title_bonus_mode: titleBonusMode.value,
  };
  const trimmedName = name.value.trim();
  if (trimmedName) config.name = trimmedName;
  emit("create", {
    quiz_type: "hitster",
    answer_type: "timeline",
    config,
  });
}

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
