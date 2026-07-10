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

    <section
      v-if="step === 1"
      class="flex flex-col items-center gap-4 py-4 text-center"
    >
      <span
        class="bg-primary/10 text-primary grid size-16 place-items-center rounded-full"
      >
        <PartyPopper class="size-8" />
      </span>
      <div class="flex flex-col gap-1">
        <h2 class="text-xl font-bold">
          {{ $t("providers.music_quiz.title") }}
        </h2>
        <p class="text-muted-foreground">
          {{ $t("providers.music_quiz.create_intro") }}
        </p>
      </div>
      <Button size="lg" @click="step = 2">
        <Sparkles class="size-4" />
        {{ $t("providers.music_quiz.new_game") }}
      </Button>
    </section>

    <section v-else-if="step === 2" class="flex flex-col gap-3">
      <h2 class="text-lg font-semibold">
        {{ $t("providers.music_quiz.choose_game_type") }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <button
          v-for="type in gameTypes"
          :key="type.id"
          type="button"
          class="hover:border-primary focus-visible:ring-ring flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border"
          :disabled="!type.available"
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
              <Badge v-if="!type.available" variant="secondary">
                {{ $t("providers.music_quiz.coming_soon") }}
              </Badge>
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
      <component
        :is="selectedType.configComponent"
        v-if="selectedType"
        :busy="busy"
        @create="onConfigCreate"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  MUSIC_QUIZ_GAME_TYPES,
  type MusicQuizGameTypeOption,
} from "@/components/music-quiz/game_types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { MusicQuizCreateRequest } from "@/composables/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { ArrowLeft, PartyPopper, Sparkles } from "@lucide/vue";
import { ref } from "vue";

const TOTAL_STEPS = 3;

defineProps<{ busy: boolean }>();
const emit = defineEmits<{ create: [request: MusicQuizCreateRequest] }>();

const gameTypes = MUSIC_QUIZ_GAME_TYPES;
const step = ref<1 | 2 | 3>(1);
const selectedType = ref<MusicQuizGameTypeOption | null>(null);

function selectType(type: MusicQuizGameTypeOption) {
  if (!type.available) return;
  selectedType.value = type;
  step.value = 3;
}

function back() {
  if (step.value === 3) {
    step.value = 2;
  } else if (step.value === 2) {
    step.value = 1;
  }
}

function onConfigCreate(request: MusicQuizCreateRequest) {
  emit("create", request);
}
</script>
