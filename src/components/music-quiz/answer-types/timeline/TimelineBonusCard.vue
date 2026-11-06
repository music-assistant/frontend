<template>
  <Card class="border-primary/30 bg-primary/5">
    <CardContent class="flex flex-col gap-4">
      <div>
        <h2 class="font-semibold">{{ label }}</h2>
        <p class="text-muted-foreground text-sm">
          {{ $t("providers.music_quiz.timeline_bonus_optional") }}
        </p>
      </div>

      <form
        v-if="bonus.mode === 'free_text'"
        class="flex flex-col gap-3"
        @submit.prevent="emit('submitText')"
      >
        <!-- The heading already names the bonus; the label stays for screen readers. -->
        <Label :for="`timeline-${bonus.bonus_type}-answer`" class="sr-only">
          {{ label }}
        </Label>
        <Input
          :id="`timeline-${bonus.bonus_type}-answer`"
          v-model="text"
          :disabled="busy"
          :maxlength="maxLength"
          autocomplete="off"
        />
        <Button type="submit" :disabled="busy || !text.trim()">
          <Send class="size-4" />
          {{ $t("providers.music_quiz.timeline_submit_bonus") }}
        </Button>
      </form>

      <MultipleChoicePlayerGrid
        v-else
        :suggestions="choices"
        :disabled="busy"
        :selected-suggestion-id="null"
        @select="emit('choose', $event)"
      />

      <Button
        type="button"
        variant="outline"
        :disabled="busy"
        @click="emit('skip')"
      >
        <SkipForward class="size-4" />
        {{ $t("providers.music_quiz.timeline_skip_remaining_bonuses") }}
      </Button>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import MultipleChoicePlayerGrid from "@/components/music-quiz/answer-types/multiple-choice/MultipleChoicePlayerGrid.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MusicQuizSuggestion,
  MusicQuizTimelineBonusDefinition,
} from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";
import { Send, SkipForward } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  bonus: MusicQuizTimelineBonusDefinition;
  label: string;
  busy: boolean;
  maxLength: number;
}>();
const emit = defineEmits<{
  submitText: [];
  choose: [optionId: string];
  skip: [];
}>();
const text = defineModel<string>("text", { required: true });

// The lettered answer grid takes suggestions; bonus options map straight on.
const choices = computed<MusicQuizSuggestion[]>(() =>
  props.bonus.mode === "multiple_choice"
    ? props.bonus.options.map((option) => ({
        suggestion_id: option.option_id,
        label: option.label,
      }))
    : [],
);
</script>
