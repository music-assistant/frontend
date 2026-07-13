<template>
  <div class="relative flex flex-col gap-5" :class="{ 'min-h-64': busy }">
    <div
      v-if="busy"
      ref="preparingStatus"
      class="bg-background absolute inset-0 z-10 flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg p-6 text-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      tabindex="-1"
      data-testid="music-quiz-preparing"
    >
      <LoaderCircle
        class="text-primary size-8 animate-spin"
        aria-hidden="true"
      />
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-semibold">
          {{ $t("providers.music_quiz.preparing_game") }}
        </h2>
        <p class="text-muted-foreground max-w-md text-sm">
          {{ $t("providers.music_quiz.preparing_game_help") }}
        </p>
      </div>
    </div>

    <div
      class="flex-col gap-2"
      :class="busy ? 'hidden' : 'flex'"
      data-testid="music-quiz-setup-progress"
    >
      <div class="flex items-center justify-between gap-3">
        <Button
          v-if="step > 1"
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="back"
        >
          <ArrowLeft class="size-4" />
          {{ $t("back") }}
        </Button>
        <span v-else></span>
        <span class="text-muted-foreground text-sm font-medium">
          {{ $t("providers.music_quiz.setup_step", [step, TOTAL_STEPS]) }}
        </span>
      </div>
      <Progress :model-value="(step / TOTAL_STEPS) * 100" />
    </div>

    <section v-if="!busy && step === 1" class="flex flex-col gap-3">
      <h2 ref="chooseHeading" class="text-lg font-semibold" tabindex="-1">
        {{ $t("providers.music_quiz.choose_game_type") }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="type in availableGameTypes"
          :key="type.id"
          type="button"
          class="hover:border-primary focus-visible:ring-ring flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          @click="selectType(type)"
        >
          <span
            class="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg"
          >
            <component :is="type.icon" class="size-5" />
          </span>
          <span class="flex min-w-0 flex-col gap-1">
            <span class="flex items-center gap-2 font-semibold">
              {{ $t(type.labelKey) }}
            </span>
            <span class="text-muted-foreground text-sm">
              {{ $t(type.descriptionKey) }}
            </span>
          </span>
        </button>
      </div>
    </section>

    <section
      class="flex-col gap-4"
      :class="!busy && step === 2 ? 'flex' : 'hidden'"
      data-testid="music-quiz-configure-step"
    >
      <div class="flex items-center gap-2">
        <component
          :is="selectedType.icon"
          v-if="selectedType"
          class="text-primary size-5"
        />
        <h2 ref="configureHeading" class="text-lg font-semibold" tabindex="-1">
          {{ $t("providers.music_quiz.configure_game") }}
        </h2>
      </div>
      <MusicQuizPlaybackControls
        v-if="playbackOptionsLoading || playbackOptions || playbackOptionsError"
        v-model="playbackSelection"
        :options="playbackOptions"
        :loading="playbackOptionsLoading"
        :error="playbackOptionsError"
        :disabled="busy"
        @retry="emit('retryPlaybackOptions')"
      />
      <KeepAlive v-if="selectedType">
        <component
          :is="
            step === 2 ? selectedType.adapters.setup : MusicQuizSetupPlaceholder
          "
          :busy="busy"
          :include-similar-music="includeSimilarMusic"
          :shared-config-valid="sharedConfigValid"
          @create="onConfigCreate"
        >
          <template #before-sources>
            <Field
              orientation="horizontal"
              class="items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div class="flex flex-col gap-1">
                <FieldLabel for="quiz-include-similar-music">
                  {{ $t("providers.music_quiz.include_similar_music") }}
                </FieldLabel>
                <FieldDescription>
                  {{ $t("providers.music_quiz.include_similar_music_help") }}
                </FieldDescription>
              </div>
              <Switch
                id="quiz-include-similar-music"
                v-model="includeSimilarMusic"
                data-testid="quiz-include-similar-music"
                :disabled="busy"
              />
            </Field>
          </template>
        </component>
      </KeepAlive>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  MUSIC_QUIZ_GAME_TYPES,
  isMusicQuizGameAvailable,
  type MusicQuizGameDefinition,
} from "@/components/music-quiz/game_types";
import MusicQuizPlaybackControls from "@/components/music-quiz/MusicQuizPlaybackControls.vue";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import type {
  MusicQuizCreateRequest,
  MusicQuizPlaybackOptions,
} from "@/composables/useMusicQuiz";
import {
  getDefaultMusicQuizPlaybackSelection,
  getMusicQuizPlaybackCreateFields,
  isMusicQuizPlaybackSelectionValid,
  type MusicQuizPlaybackSelection,
} from "@/helpers/music_quiz_playback";
import { $t } from "@/plugins/i18n";
import { ArrowLeft, LoaderCircle } from "@lucide/vue";
import { computed, defineComponent, nextTick, ref, watch } from "vue";

const TOTAL_STEPS = 2;
const MusicQuizSetupPlaceholder = defineComponent({
  inheritAttrs: false,
  setup: () => () => null,
});

const props = withDefaults(
  defineProps<{
    busy: boolean;
    availableQuizTypes?: string[];
    playbackOptions?: MusicQuizPlaybackOptions | null;
    playbackOptionsLoading?: boolean;
    playbackOptionsLegacy?: boolean;
    playbackOptionsError?: boolean;
  }>(),
  {
    availableQuizTypes: () => [],
    playbackOptions: null,
    playbackOptionsLoading: false,
    playbackOptionsLegacy: true,
    playbackOptionsError: false,
  },
);
const emit = defineEmits<{
  create: [request: MusicQuizCreateRequest];
  retryPlaybackOptions: [];
}>();

const availableGameTypes = computed(() =>
  MUSIC_QUIZ_GAME_TYPES.filter((type) =>
    isMusicQuizGameAvailable(type, props.availableQuizTypes),
  ),
);
const step = ref<1 | 2>(1);
const selectedType = ref<MusicQuizGameDefinition | null>(null);
const includeSimilarMusic = ref(false);
const playbackSelection = ref<MusicQuizPlaybackSelection>({
  mode: null,
  venuePlayerId: null,
});
const chooseHeading = ref<HTMLHeadingElement | null>(null);
const configureHeading = ref<HTMLHeadingElement | null>(null);
const preparingStatus = ref<HTMLElement | null>(null);
const sharedConfigValid = computed(() => {
  if (props.playbackOptionsLoading) return false;
  if (props.playbackOptions) {
    return isMusicQuizPlaybackSelectionValid(
      playbackSelection.value,
      props.playbackOptions,
    );
  }
  return props.playbackOptionsLegacy && !props.playbackOptionsError;
});

watch(
  () => props.playbackOptions,
  (options) => {
    if (options) {
      playbackSelection.value = getDefaultMusicQuizPlaybackSelection(options);
    }
  },
  { immediate: true },
);

watch(
  () => props.busy,
  async (busy) => {
    if (!busy) return;
    await nextTick();
    preparingStatus.value?.focus({ preventScroll: true });
  },
  { immediate: true },
);

async function selectType(type: MusicQuizGameDefinition) {
  selectedType.value = type;
  await nextTick();
  step.value = 2;
  await nextTick();
  configureHeading.value?.focus({ preventScroll: true });
}

async function back() {
  step.value = 1;
  await nextTick();
  chooseHeading.value?.focus({ preventScroll: true });
}

function onConfigCreate(request: MusicQuizCreateRequest) {
  if (!sharedConfigValid.value) return;
  const playbackFields = props.playbackOptions
    ? getMusicQuizPlaybackCreateFields(
        playbackSelection.value,
        props.playbackOptions,
      )
    : null;
  if (props.playbackOptions && !playbackFields) return;
  if (playbackFields) {
    emit("create", { ...request, ...playbackFields });
    return;
  }
  emit("create", request);
}
</script>
