<template>
  <!-- New game, one step at a time: Game, Music, Rules, Plays on, Check. -->
  <div
    class="relative isolate flex flex-col gap-5"
    :class="{ 'min-h-64': busy }"
    data-testid="music-quiz-stepped-setup"
  >
    <MusicQuizPreparingState
      v-if="busy"
      autofocus
      class="absolute inset-0 z-10 rounded-lg"
    />

    <div class="flex flex-col gap-3" :class="{ hidden: busy }">
      <div class="flex min-w-0 items-center gap-2 pe-8">
        <Button
          v-if="step > 1"
          variant="ghost"
          size="icon"
          class="-ms-2 shrink-0"
          :aria-label="$t('back')"
          :title="$t('back')"
          @click="goTo(step - 1)"
        >
          <ArrowLeft class="size-4 rtl:rotate-180" />
        </Button>
        <component
          :is="selectedType.icon"
          v-if="step > 1 && selectedType"
          class="text-primary size-5 shrink-0"
          aria-hidden="true"
        />
        <div class="flex min-w-0 flex-col">
          <p
            class="text-muted-foreground text-xs font-medium"
            data-testid="setup-progress"
          >
            {{ $t("providers.music_quiz.setup_progress", [step, STEP_COUNT]) }}
          </p>
          <h2
            ref="stepHeading"
            class="truncate text-lg font-semibold"
            tabindex="-1"
          >
            {{ headingText }}
          </h2>
        </div>
      </div>
      <div class="flex gap-1" aria-hidden="true">
        <span
          v-for="n in STEP_COUNT"
          :key="n"
          class="h-1 flex-1 rounded-full transition-colors"
          :class="n <= step ? 'bg-primary' : 'bg-muted'"
        ></span>
      </div>
    </div>

    <!-- 1 · Game -->
    <section
      v-if="!busy && step === 1"
      class="grid auto-rows-fr gap-3 sm:grid-cols-2"
    >
      <button
        v-for="type in availableGameTypes"
        :key="type.id"
        type="button"
        class="hover:border-primary focus-visible:ring-ring bg-card flex items-center gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
        :class="{ 'border-primary': selectedType?.id === type.id }"
        :aria-pressed="selectedType?.id === type.id"
        @click="selectType(type)"
      >
        <span
          class="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-md"
        >
          <component :is="type.icon" class="size-6" />
        </span>
        <span class="flex min-w-0 flex-col gap-1">
          <span class="font-semibold">{{ $t(type.labelKey) }}</span>
          <span class="text-muted-foreground text-sm">
            {{ $t(type.descriptionKey) }}
          </span>
        </span>
      </button>
    </section>

    <!-- 2 · Music (kept on the page so the picks survive Back and Next).
         Hidden with the `hidden` class, not v-show: Tailwind's !important
         `flex` would beat v-show's inline display:none. -->
    <section
      class="flex-col gap-4"
      :class="!busy && step === 2 ? 'flex' : 'hidden'"
    >
      <MusicQuizSuggestedSource
        :selected-uris="sourceUris"
        :disabled="busy"
        @add="sourceSelector?.add($event)"
      />
      <MusicQuizSourceSelector
        ref="selector"
        v-model="sourceUris"
        input-id="setup-source-search"
      />
      <Field
        orientation="horizontal"
        class="items-center justify-between gap-4 rounded-lg border p-4"
      >
        <div class="flex flex-col gap-1">
          <FieldLabel for="setup-include-similar-music">
            {{ $t("providers.music_quiz.include_similar_music") }}
          </FieldLabel>
          <FieldDescription>
            {{ $t("providers.music_quiz.include_similar_music_help") }}
          </FieldDescription>
        </div>
        <Switch
          id="setup-include-similar-music"
          v-model="includeSimilarMusic"
          :disabled="busy"
        />
      </Field>
    </section>

    <!-- 3 · Rules: the game's own settings, without its music or Create -->
    <section :class="{ hidden: busy || step !== 3 }">
      <component
        :is="selectedType.adapters.setup"
        v-if="selectedType"
        :key="selectedType.id"
        ref="gameSetup"
        stage="rules"
        :busy="busy"
        :include-similar-music="includeSimilarMusic"
        :shared-config-valid="sharedConfigValid"
      />
    </section>

    <!-- 4 · Plays on -->
    <section
      class="flex-col gap-3"
      :class="!busy && step === 4 ? 'flex' : 'hidden'"
    >
      <MusicQuizPlaybackControls
        v-if="playbackOptionsLoading || playbackOptions || playbackOptionsError"
        v-model="playbackSelection"
        :options="playbackOptions"
        :loading="playbackOptionsLoading"
        :error="playbackOptionsError"
        :disabled="busy"
        hide-title
        @retry="emit('retryPlaybackOptions')"
      />
      <p
        v-if="playbackOptions && playbackSelection.mode === 'venue'"
        class="text-muted-foreground text-sm"
      >
        {{ $t("providers.music_quiz.setup_speakers_note") }}
      </p>
    </section>

    <!-- 5 · Check & start -->
    <MusicQuizSetupSummary
      v-if="!busy && step === 5 && selectedType"
      :game="selectedType"
      :request="summaryRequest"
      :music-names="musicNames"
      :plays-on="playsOn"
      @change="goTo"
    />

    <div
      v-if="!busy && step > 1"
      class="bg-background sticky bottom-0 flex justify-end pt-2"
    >
      <Button
        v-if="step < STEP_COUNT"
        size="lg"
        class="w-full sm:w-auto"
        :disabled="!canContinue"
        data-testid="setup-next"
        @click="goTo(step + 1)"
      >
        {{ $t("providers.music_quiz.setup_next") }}
        <ArrowRight class="size-4 rtl:rotate-180" />
      </Button>
      <Button
        v-else
        size="lg"
        class="w-full sm:w-auto"
        :disabled="!canCreate"
        data-testid="setup-create"
        @click="create"
      >
        <Plus class="size-4" />
        {{ $t("providers.music_quiz.setup_create_game") }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  MUSIC_QUIZ_GAME_TYPES,
  isMusicQuizGameAvailable,
  type MusicQuizGameDefinition,
} from "@/components/music-quiz/game_types";
import MusicQuizPlaybackControls from "@/components/music-quiz/MusicQuizPlaybackControls.vue";
import MusicQuizPreparingState from "@/components/music-quiz/MusicQuizPreparingState.vue";
import MusicQuizSetupSummary from "@/components/music-quiz/MusicQuizSetupSummary.vue";
import MusicQuizSourceSelector from "@/components/music-quiz/MusicQuizSourceSelector.vue";
import MusicQuizSuggestedSource from "@/components/music-quiz/MusicQuizSuggestedSource.vue";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type {
  MusicQuizCreateRequest,
  MusicQuizPlaybackOptions,
} from "@/composables/music-quiz/useMusicQuiz";
import type { MusicQuizSourceItem } from "@/composables/music-quiz/useMusicQuizSources";
import {
  getMusicQuizPlaybackCreateFields,
  isMusicQuizPlaybackSelectionValid,
  reconcileMusicQuizPlaybackSelection,
  type MusicQuizPlaybackSelection,
} from "@/helpers/music_quiz_playback";
import type { MediaItemTypeOrItemMapping } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ArrowLeft, ArrowRight, Plus } from "@lucide/vue";
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";

const STEP_COUNT = 5;
const STEP_HEADINGS = [
  "providers.music_quiz.choose_game_type",
  "providers.music_quiz.setup_step_music",
  "providers.music_quiz.setup_step_rules",
  "providers.music_quiz.setup_step_plays_on",
  "providers.music_quiz.setup_step_check",
];

const props = withDefaults(
  defineProps<{
    busy: boolean;
    availableQuizTypes?: string[];
    playbackOptions?: MusicQuizPlaybackOptions | null;
    playbackOptionsLoading?: boolean;
    playbackOptionsError?: boolean;
  }>(),
  {
    availableQuizTypes: () => [],
    playbackOptions: null,
    playbackOptionsLoading: false,
    playbackOptionsError: false,
  },
);
const emit = defineEmits<{
  create: [request: MusicQuizCreateRequest];
  retryPlaybackOptions: [];
}>();
const playbackSelection = defineModel<MusicQuizPlaybackSelection>(
  "playbackSelection",
  { default: () => ({ mode: null, venuePlayerId: null }) },
);

const sourceSelector = useTemplateRef<{
  add: (item: MediaItemTypeOrItemMapping) => void;
  selected: MusicQuizSourceItem[];
}>("selector");
const gameSetupRef = useTemplateRef<{
  buildRequest: (uris: string[]) => MusicQuizCreateRequest;
}>("gameSetup");
const headingRef = useTemplateRef<HTMLHeadingElement>("stepHeading");

const step = ref(1);
const selectedType = ref<MusicQuizGameDefinition | null>(null);
const sourceUris = ref<string[]>([]);
const includeSimilarMusic = ref(false);

const availableGameTypes = computed(() =>
  MUSIC_QUIZ_GAME_TYPES.filter((type) =>
    isMusicQuizGameAvailable(type, props.availableQuizTypes),
  ),
);
const headingText = computed(() => $t(STEP_HEADINGS[step.value - 1]));

const sharedConfigValid = computed(
  () =>
    !props.playbackOptionsLoading &&
    !!props.playbackOptions &&
    isMusicQuizPlaybackSelectionValid(
      playbackSelection.value,
      props.playbackOptions,
    ),
);
// Next waits until the step is complete.
const canContinue = computed(() => {
  if (step.value === 2) return sourceUris.value.length > 0;
  if (step.value === 4) return sharedConfigValid.value;
  return true;
});
const canCreate = computed(
  () =>
    !!gameSetupRef.value &&
    sourceUris.value.length > 0 &&
    sharedConfigValid.value,
);

const summaryRequest = computed(
  () => gameSetupRef.value?.buildRequest(sourceUris.value) ?? null,
);
const musicNames = computed(
  () => sourceSelector.value?.selected.map((item) => item.name) ?? [],
);
const playsOn = computed(() => {
  const selection = playbackSelection.value;
  if (selection.mode === "remote") {
    return $t("providers.music_quiz.playback_summary_remote");
  }
  const speaker = props.playbackOptions?.venue_players.find(
    (player) => player.player_id === selection.venuePlayerId,
  );
  return speaker
    ? $t("providers.music_quiz.playback_summary_venue", [speaker.name])
    : $t("providers.music_quiz.playback_venue");
});

watch(
  () => props.playbackOptions,
  (options) => {
    if (!options) return;
    const reconciled = reconcileMusicQuizPlaybackSelection(
      playbackSelection.value,
      options,
    );
    if (reconciled !== playbackSelection.value) {
      playbackSelection.value = reconciled;
    }
  },
  { immediate: true },
);

async function goTo(target: number) {
  step.value = Math.min(Math.max(target, 1), STEP_COUNT);
  await nextTick();
  // Not preventScroll: a step opened part-way down should show its heading.
  headingRef.value?.focus();
}

function selectType(type: MusicQuizGameDefinition) {
  selectedType.value = type;
  void goTo(2);
}

function create() {
  const request = gameSetupRef.value?.buildRequest(sourceUris.value);
  if (!request || !canCreate.value || !props.playbackOptions) return;
  const playbackFields = getMusicQuizPlaybackCreateFields(
    playbackSelection.value,
    props.playbackOptions,
  );
  if (playbackFields) emit("create", { ...request, ...playbackFields });
}
</script>
