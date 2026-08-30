<template>
  <div
    class="relative isolate flex flex-col gap-5"
    :class="{ 'min-h-64': busy }"
  >
    <MusicQuizPreparingState
      v-if="busy"
      autofocus
      class="absolute inset-0 z-10 rounded-lg"
    />

    <div
      class="flex min-w-0 items-center gap-2 pr-8"
      :class="{ hidden: busy }"
      data-testid="music-quiz-setup-header"
    >
      <Button
        v-if="step === 2"
        variant="ghost"
        size="icon"
        class="-ml-2 shrink-0"
        :aria-label="$t('back')"
        :title="$t('back')"
        :disabled="busy"
        @click="back"
      >
        <ArrowLeft class="size-4" />
      </Button>
      <component
        :is="selectedType.icon"
        v-if="step === 2 && selectedType"
        class="text-primary size-5 shrink-0"
        aria-hidden="true"
      />
      <h2
        ref="stepHeading"
        class="truncate text-lg font-semibold"
        tabindex="-1"
        data-testid="music-quiz-setup-heading"
      >
        {{ headingText }}
      </h2>
    </div>

    <section v-if="!busy && step === 1" class="flex flex-col gap-3 mt-2">
      <div class="grid auto-rows-fr gap-3 sm:grid-cols-2">
        <button
          v-for="type in availableGameTypes"
          :key="type.id"
          type="button"
          class="hover:border-primary focus-visible:ring-ring bg-card flex items-center gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          @click="selectType(type)"
        >
          <span
            class="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-md"
          >
            <component :is="type.icon" class="size-6" />
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
import MusicQuizPreparingState from "@/components/music-quiz/MusicQuizPreparingState.vue";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type {
  MusicQuizCreateRequest,
  MusicQuizPlaybackOptions,
} from "@/composables/music-quiz/useMusicQuiz";
import {
  getMusicQuizPlaybackCreateFields,
  isMusicQuizPlaybackSelectionValid,
  reconcileMusicQuizPlaybackSelection,
  type MusicQuizPlaybackSelection,
} from "@/helpers/music_quiz_playback";
import { $t } from "@/plugins/i18n";
import { ArrowLeft } from "@lucide/vue";
import { computed, defineComponent, nextTick, ref, watch } from "vue";

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
const playbackSelection = defineModel<MusicQuizPlaybackSelection>(
  "playbackSelection",
  {
    default: () => ({
      mode: null,
      venuePlayerId: null,
    }),
  },
);

const availableGameTypes = computed(() =>
  MUSIC_QUIZ_GAME_TYPES.filter((type) =>
    isMusicQuizGameAvailable(type, props.availableQuizTypes),
  ),
);
const step = ref<1 | 2>(1);
const selectedType = ref<MusicQuizGameDefinition | null>(null);
const includeSimilarMusic = ref(false);
const stepHeading = ref<HTMLHeadingElement | null>(null);
const headingText = computed(() =>
  step.value === 1
    ? $t("providers.music_quiz.choose_game_type")
    : selectedType.value
      ? $t(selectedType.value.labelKey)
      : $t("providers.music_quiz.configure_game"),
);
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
      const reconciled = reconcileMusicQuizPlaybackSelection(
        playbackSelection.value,
        options,
      );
      if (reconciled !== playbackSelection.value) {
        playbackSelection.value = reconciled;
      }
    }
  },
  { immediate: true },
);

async function selectType(type: MusicQuizGameDefinition) {
  selectedType.value = type;
  await nextTick();
  step.value = 2;
  await nextTick();
  stepHeading.value?.focus({ preventScroll: true });
}

async function back() {
  step.value = 1;
  await nextTick();
  stepHeading.value?.focus({ preventScroll: true });
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
