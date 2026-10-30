<template>
  <!-- Every choice once, each with a way back to change it. -->
  <dl
    class="divide-border flex flex-col divide-y rounded-xl border"
    data-testid="setup-summary"
  >
    <div
      v-for="row in rows"
      :key="row.step"
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4"
    >
      <div class="flex min-w-0 flex-col gap-1">
        <dt class="text-muted-foreground text-sm">{{ row.label }}</dt>
        <dd class="font-medium break-words">{{ row.value }}</dd>
      </div>
      <Button
        variant="ghost"
        size="sm"
        :aria-label="$t('providers.music_quiz.setup_change_item', [row.label])"
        @click="emit('change', row.step)"
      >
        {{ $t("providers.music_quiz.setup_change") }}
      </Button>
    </div>
  </dl>
</template>

<script setup lang="ts">
import type { MusicQuizGameDefinition } from "@/components/music-quiz/game_types";
import { Button } from "@/components/ui/button";
import type {
  MusicQuizCreateRequest,
  MusicQuizTimelineBonusMode,
} from "@/composables/music-quiz/useMusicQuiz";
import { getMusicQuizDifficultyOptions } from "@/helpers/music_quiz";
import { $t, getLocaleDisplayName, i18n } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{
  game: MusicQuizGameDefinition;
  request: MusicQuizCreateRequest | null;
  musicNames: string[];
  playsOn: string;
}>();
const emit = defineEmits<{ change: [step: number] }>();

const rows = computed(() =>
  [
    {
      step: 1,
      label: $t("providers.music_quiz.setup_step_game"),
      value: $t(props.game.labelKey),
    },
    {
      step: 2,
      label: $t("providers.music_quiz.setup_step_music"),
      value: musicSummary(props.musicNames),
    },
    {
      step: 3,
      label: $t("providers.music_quiz.setup_step_rules"),
      value: props.request ? rulesSummary(props.request) : "",
    },
    {
      step: 4,
      label: $t("providers.music_quiz.setup_step_plays_on"),
      value: props.playsOn,
    },
  ].filter((row) => row.value),
);

/** "Blind Test" or "Blind Test + 2 more". */
function musicSummary(names: string[]): string {
  const [first, ...rest] = names;
  if (!first) return "";
  return rest.length
    ? $t("providers.music_quiz.setup_music_more", [first, rest.length])
    : first;
}

/** "5 rounds · 30 seconds to answer · 4 choices · Normal", per game. */
function rulesSummary(request: MusicQuizCreateRequest): string {
  const { config } = request;
  const parts = [
    $t("providers.music_quiz.setup_rules_rounds", [config.round_count]),
    $t("providers.music_quiz.setup_rules_seconds", [config.answer_duration]),
  ];
  if (request.quiz_type === "music_timeline") {
    parts.push(
      $t("providers.music_quiz.setup_rules_bonus", [
        $t("providers.music_quiz.timeline_artist_bonus"),
        bonusLabel(request.config.artist_bonus_mode),
      ]),
      $t("providers.music_quiz.setup_rules_bonus", [
        $t("providers.music_quiz.timeline_title_bonus"),
        bonusLabel(request.config.title_bonus_mode),
      ]),
    );
    return parts.join(" · ");
  }
  parts.push(
    $t("providers.music_quiz.setup_rules_choices", [
      request.config.suggestion_count,
    ]),
  );
  const difficulty = getMusicQuizDifficultyOptions().find(
    (option) => option.value === request.config.difficulty,
  );
  if (difficulty) parts.push(difficulty.label);
  if (request.quiz_type === "trivia") {
    parts.push(
      getLocaleDisplayName(request.config.language, i18n.global.locale.value),
    );
    if (request.config.play_reveal_audio) {
      parts.push($t("providers.music_quiz.play_revealed_songs"));
    }
  }
  return parts.join(" · ");
}

function bonusLabel(mode: MusicQuizTimelineBonusMode): string {
  if (mode === "free_text") {
    return $t("providers.music_quiz.timeline_bonus_free_text");
  }
  if (mode === "multiple_choice") {
    return $t("providers.music_quiz.timeline_bonus_multiple_choice");
  }
  return $t("providers.music_quiz.timeline_bonus_off");
}
</script>
