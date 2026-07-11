<template>
  <div class="flex flex-col gap-5">
    <p
      v-if="!available"
      class="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
      role="alert"
    >
      {{ $t("providers.music_quiz.trivia_requires_ai_provider") }}
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <Field class="sm:col-span-2">
        <FieldLabel for="trivia-name">
          {{ $t("providers.music_quiz.session_name") }}
        </FieldLabel>
        <Input id="trivia-name" v-model="name" />
      </Field>

      <Field>
        <FieldLabel for="trivia-rounds">
          {{ $t("providers.music_quiz.rounds") }}
        </FieldLabel>
        <NumberField
          id="trivia-rounds"
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
        <FieldLabel for="trivia-choices">
          {{ $t("providers.music_quiz.answer_choices") }}
        </FieldLabel>
        <NumberField
          id="trivia-choices"
          v-model="suggestionCount"
          :min="MIN_CHOICES"
          :max="MAX_CHOICES"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </Field>

      <Field>
        <FieldLabel for="trivia-seconds">
          {{ $t("providers.music_quiz.answer_seconds") }}
        </FieldLabel>
        <NumberField
          id="trivia-seconds"
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
        <FieldLabel for="trivia-difficulty">
          {{ $t("providers.music_quiz.difficulty") }}
        </FieldLabel>
        <NativeSelect
          id="trivia-difficulty"
          v-model="difficulty"
          class="w-full"
        >
          <option value="easy">
            {{ $t("providers.music_quiz.difficulty_easy") }}
          </option>
          <option value="normal">
            {{ $t("providers.music_quiz.difficulty_normal") }}
          </option>
          <option value="hard">
            {{ $t("providers.music_quiz.difficulty_hard") }}
          </option>
        </NativeSelect>
      </Field>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <Field>
        <FieldLabel for="trivia-source-search">
          {{ $t("providers.music_quiz.add_music_sources") }}
        </FieldLabel>
        <MediaSearch
          input-id="trivia-source-search"
          :allowed-media-types="MUSIC_QUIZ_SOURCE_MEDIA_TYPES"
          :default-selected-media-types="MUSIC_QUIZ_DEFAULT_SOURCE_MEDIA_TYPES"
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

    <Button size="lg" :disabled="busy || !canSubmit" @click="create">
      <Sparkles class="size-4" />
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
  MusicQuizDifficulty,
  MusicQuizTriviaConfig,
} from "@/composables/useMusicQuiz";
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
import { Sparkles, X } from "@lucide/vue";
import { computed, ref } from "vue";

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 100;
const MIN_CHOICES = 2;
const MAX_CHOICES = 12;
const MIN_SECONDS = 1;
const MAX_SECONDS = 300;

const props = withDefaults(defineProps<MusicQuizSetupAdapterProps>(), {
  available: false,
});
const emit = defineEmits<MusicQuizSetupAdapterEmits>();

const name = ref("");
const roundCount = ref(5);
const suggestionCount = ref(4);
const answerDuration = ref(30);
const difficulty = ref<MusicQuizDifficulty>("normal");

const {
  selected: selectedSources,
  sourceUris,
  summary: selectedSummary,
  canCreate,
  add: addSource,
  remove: removeSource,
} = useMusicQuizSources();

const hasValidSettings = computed(
  () =>
    roundCount.value >= MIN_ROUNDS &&
    roundCount.value <= MAX_ROUNDS &&
    suggestionCount.value >= MIN_CHOICES &&
    suggestionCount.value <= MAX_CHOICES &&
    answerDuration.value >= MIN_SECONDS &&
    answerDuration.value <= MAX_SECONDS,
);
const canSubmit = computed(
  () => props.available && canCreate.value && hasValidSettings.value,
);

function onSourceSelect(item: MediaItemTypeOrItemMapping) {
  if (!isMusicQuizSourceItem(item)) return;
  addSource(item);
}

function create() {
  if (!canSubmit.value) return;
  const config: MusicQuizTriviaConfig = {
    round_count: roundCount.value,
    suggestion_count: suggestionCount.value,
    answer_duration: answerDuration.value,
    source_uris: sourceUris.value,
    difficulty: difficulty.value,
  };
  const trimmedName = name.value.trim();
  if (trimmedName) config.name = trimmedName;
  emit("create", {
    quiz_type: "trivia",
    answer_type: "multiple_choice",
    config,
  });
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
