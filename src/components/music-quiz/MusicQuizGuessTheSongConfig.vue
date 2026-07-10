<template>
  <div class="flex flex-col gap-5">
    <div class="grid gap-4 sm:grid-cols-2">
      <Field class="sm:col-span-2">
        <FieldLabel for="quiz-name">
          {{ $t("providers.music_quiz.session_name") }}
        </FieldLabel>
        <Input id="quiz-name" v-model="name" />
      </Field>

      <Field>
        <FieldLabel for="quiz-rounds">
          {{ $t("providers.music_quiz.rounds") }}
        </FieldLabel>
        <NumberField
          id="quiz-rounds"
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
        <FieldLabel for="quiz-choices">
          {{ $t("providers.music_quiz.answer_choices") }}
        </FieldLabel>
        <NumberField
          id="quiz-choices"
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
        <FieldLabel for="quiz-seconds">
          {{ $t("providers.music_quiz.answer_seconds") }}
        </FieldLabel>
        <NumberField
          id="quiz-seconds"
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
        <FieldLabel for="quiz-difficulty">
          {{ $t("providers.music_quiz.difficulty") }}
        </FieldLabel>
        <NativeSelect id="quiz-difficulty" v-model="difficulty" class="w-full">
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
        <FieldLabel for="quiz-source-search">
          {{ $t("providers.music_quiz.add_tracks_or_playlists") }}
        </FieldLabel>
        <SearchInput
          id="quiz-source-search"
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

    <Button size="lg" :disabled="busy || !canCreate" @click="create">
      <PartyPopper class="size-4" />
      {{ $t("create") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
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
import { SearchInput } from "@/components/ui/search-input";
import type {
  MusicQuizDifficulty,
  MusicQuizGuessTheSongCreateRequest,
} from "@/composables/useMusicQuiz";
import {
  useMusicQuizSourceSearch,
  type MusicQuizSourceItem,
} from "@/composables/useMusicQuizSourceSearch";
import { generateMusicQuizSessionName } from "@/helpers/music_quiz_naming";
import { MediaType, type Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { PartyPopper, X } from "@lucide/vue";
import { ref } from "vue";

const MIN_ROUNDS = 2;
const MAX_ROUNDS = 50;
const MIN_CHOICES = 2;
const MAX_CHOICES = 8;
const MIN_SECONDS = 5;
const MAX_SECONDS = 120;

defineProps<{ busy: boolean }>();
const emit = defineEmits<{
  create: [request: MusicQuizGuessTheSongCreateRequest];
}>();

const name = ref(generateMusicQuizSessionName());
const roundCount = ref(5);
const suggestionCount = ref(4);
const answerDuration = ref(30);
const difficulty = ref<MusicQuizDifficulty>("normal");

const {
  query: sourceQuery,
  results: sourceResults,
  selected: selectedSources,
  searching: sourceSearching,
  sourceUris,
  summary: selectedSummary,
  canCreate,
  minSearchLength,
  add: addSource,
  remove: removeSource,
} = useMusicQuizSourceSearch();

function create() {
  if (!canCreate.value) return;
  emit("create", {
    quiz_type: "guess_the_song",
    answer_type: "multiple_choice",
    config: {
      round_count: roundCount.value,
      suggestion_count: suggestionCount.value,
      answer_duration: answerDuration.value,
      difficulty: difficulty.value,
      source_uris: sourceUris.value,
      name: name.value.trim() || generateMusicQuizSessionName(),
    },
  });
}

function sourceSubtitle(item: MusicQuizSourceItem) {
  if (item.media_type === MediaType.PLAYLIST)
    return $t("providers.music_quiz.playlist");
  const artist = (item as Track).artists?.[0]?.name;
  return artist
    ? $t("providers.music_quiz.track_with_artist", [artist])
    : $t("providers.music_quiz.track");
}
</script>
