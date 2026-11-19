<template>
  <form
    v-if="!bonus.done"
    class="flex flex-col gap-2 rounded-lg border p-4"
    data-testid="hint-text-artist-bonus"
    @submit.prevent="submitGuess"
  >
    <Label for="hint-text-artist-guess" class="flex items-center gap-2">
      <Mic class="text-primary size-4" />
      {{ $t("providers.music_quiz.title_reveal_artist_bonus_label") }}
    </Label>
    <p class="text-muted-foreground text-sm">
      {{ $t("providers.music_quiz.title_reveal_artist_bonus_help") }}
    </p>
    <Input
      id="hint-text-artist-guess"
      ref="inputRef"
      v-model="guess"
      :maxlength="MUSIC_QUIZ_HINT_TEXT_MAX_GUESS_LENGTH"
      :placeholder="$t('providers.music_quiz.title_reveal_artist_placeholder')"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="send"
      class="h-11 text-base"
      data-testid="hint-text-artist-input"
    />
    <div class="flex gap-2">
      <Button
        type="submit"
        class="flex-1"
        :disabled="busy || !guess.trim()"
        data-testid="hint-text-artist-submit"
      >
        <Send class="size-4" />
        {{ $t("providers.music_quiz.title_reveal_submit_guess") }}
      </Button>
      <Button
        type="button"
        variant="outline"
        :disabled="busy"
        data-testid="hint-text-artist-skip"
        @click="skip"
      >
        {{ $t("providers.music_quiz.title_reveal_artist_skip") }}
      </Button>
    </div>
  </form>

  <p
    v-else
    class="flex items-center justify-center gap-2 text-center"
    role="status"
    data-testid="hint-text-artist-result"
  >
    <Check v-if="bonus.correct" class="text-primary size-4 shrink-0" />
    <X v-else class="text-destructive size-4 shrink-0" />
    <span>{{ resultLabel }}</span>
  </p>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MusicQuizHintTextArtistBonus,
  MusicQuizHintTextSubmission,
} from "@/composables/music-quiz/useMusicQuiz";
import { MUSIC_QUIZ_HINT_TEXT_MAX_GUESS_LENGTH } from "@/helpers/music_quiz_hint_text";
import { $t } from "@/plugins/i18n";
import { Check, Mic, Send, X } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";

const props = defineProps<{
  bonus: MusicQuizHintTextArtistBonus;
  busy: boolean;
}>();
const emit = defineEmits<{
  submit: [submission: MusicQuizHintTextSubmission];
}>();

const guess = ref("");
const inputRef = ref<InstanceType<typeof Input> | null>(null);

const resultLabel = computed(() => {
  const artist = props.bonus.artist ?? "";
  if (props.bonus.correct) {
    return $t("providers.music_quiz.title_reveal_artist_correct", [
      artist,
      props.bonus.points ?? 0,
    ]);
  }
  return props.bonus.guess
    ? $t("providers.music_quiz.title_reveal_artist_wrong", [artist])
    : $t("providers.music_quiz.title_reveal_artist_skipped", [artist]);
});

// the bonus appears right after a correct title, so the player can keep typing
onMounted(() => inputRef.value?.focus());

function submitGuess() {
  const text = guess.value.trim();
  if (!text || props.busy) return;
  emit("submit", { answer_type: "hint_text", action: "guess_artist", text });
}

function skip() {
  if (props.busy) return;
  emit("submit", { answer_type: "hint_text", action: "skip_artist" });
}
</script>
