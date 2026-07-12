<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-col gap-2">
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

    <section v-if="step === 1" class="flex flex-col gap-3">
      <h2 class="text-lg font-semibold">
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

    <section v-else class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <component
          :is="selectedType.icon"
          v-if="selectedType"
          class="text-primary size-5"
        />
        <h2 class="text-lg font-semibold">
          {{ $t("providers.music_quiz.configure_game") }}
        </h2>
      </div>
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
      <component
        :is="selectedType.adapters.setup"
        v-if="selectedType"
        :busy="busy"
        :include-similar-music="includeSimilarMusic"
        @create="onConfigCreate"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  MUSIC_QUIZ_GAME_TYPES,
  isMusicQuizGameAvailable,
  type MusicQuizGameDefinition,
} from "@/components/music-quiz/game_types";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import type { MusicQuizCreateRequest } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { ArrowLeft } from "@lucide/vue";
import { computed, ref } from "vue";

const TOTAL_STEPS = 2;

const props = withDefaults(
  defineProps<{ busy: boolean; availableQuizTypes?: string[] }>(),
  {
    availableQuizTypes: () => [],
  },
);
const emit = defineEmits<{ create: [request: MusicQuizCreateRequest] }>();

const availableGameTypes = computed(() =>
  MUSIC_QUIZ_GAME_TYPES.filter((type) =>
    isMusicQuizGameAvailable(type, props.availableQuizTypes),
  ),
);
const step = ref<1 | 2>(1);
const selectedType = ref<MusicQuizGameDefinition | null>(null);
const includeSimilarMusic = ref(false);

function selectType(type: MusicQuizGameDefinition) {
  selectedType.value = type;
  step.value = 2;
}

function back() {
  step.value = 1;
}

function onConfigCreate(request: MusicQuizCreateRequest) {
  emit("create", request);
}
</script>
