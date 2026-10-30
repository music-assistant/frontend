<template>
  <Sheet v-model:open="open">
    <SheetContent
      side="right"
      :show-close="false"
      class="w-full overflow-y-auto sm:max-w-md"
      data-testid="game-settings-sheet"
    >
      <SheetHeader class="flex-row items-center gap-2 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          data-testid="game-settings-back"
          :aria-label="$t('back')"
          @click="open = false"
        >
          <ArrowLeft class="size-5 rtl:rotate-180" />
        </Button>
        <SheetTitle class="text-lg">
          {{ $t("providers.music_quiz.game_settings_title") }}
        </SheetTitle>
        <SheetDescription class="sr-only">
          {{ $t("providers.music_quiz.game_settings_locked") }}
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-5 px-4 pb-4">
        <dl class="divide-border divide-y">
          <div
            v-for="row in rows"
            :key="row.label"
            class="flex items-baseline justify-between gap-4 py-2.5"
          >
            <dt class="text-muted-foreground">{{ row.label }}</dt>
            <dd class="text-end font-medium">{{ row.value }}</dd>
          </div>
        </dl>

        <section v-if="sources.length" class="flex flex-col gap-2">
          <h3 class="text-muted-foreground text-sm font-medium">
            {{ $t("providers.music_quiz.selected_music") }}
          </h3>
          <ul class="list-none flex flex-col gap-2">
            <li
              v-for="source in sources"
              :key="source.uri"
              class="bg-muted/40 min-w-0 rounded-md border px-3 py-2"
            >
              <strong class="block truncate">{{ source.name }}</strong>
              <small class="text-muted-foreground block truncate">
                {{ musicQuizSourceTypeLabel(source.media_type) }}
              </small>
            </li>
          </ul>
        </section>

        <p class="text-muted-foreground text-sm">
          {{ $t("providers.music_quiz.game_settings_locked") }}
        </p>

        <Button
          v-if="showPluginSettings"
          variant="outline"
          class="justify-between"
          data-testid="game-settings-plugin"
          @click="emit('plugin-settings')"
        >
          {{ $t("providers.music_quiz.settings") }}
          <ChevronRight class="size-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import type { MusicQuizGameDefinition } from "@/components/music-quiz/game_types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  MusicQuizSupportedHostState,
  MusicQuizTimelineBonusMode,
} from "@/composables/music-quiz/useMusicQuiz";
import { musicQuizSourceTypeLabel } from "@/helpers/music_quiz_sources";
import { $t, getLocaleDisplayName, i18n } from "@/plugins/i18n";
import { ArrowLeft, ChevronRight } from "@lucide/vue";
import { computed } from "vue";

interface SettingRow {
  label: string;
  value: string;
}

const props = defineProps<{
  state: MusicQuizSupportedHostState;
  game: MusicQuizGameDefinition;
  showPluginSettings: boolean;
}>();
const emit = defineEmits<{ "plugin-settings": [] }>();
const open = defineModel<boolean>("open", { required: true });

const BONUS_MODE_KEYS: Record<MusicQuizTimelineBonusMode, string> = {
  off: "providers.music_quiz.timeline_bonus_off",
  free_text: "providers.music_quiz.timeline_bonus_free_text",
  multiple_choice: "providers.music_quiz.timeline_bonus_multiple_choice",
};

function yesNo(value: boolean): string {
  return $t(value ? "yes" : "no");
}

const sources = computed(() => props.state.sources ?? []);

const playbackText = computed(() => {
  const playback = props.state.playback;
  if ((playback?.mode ?? props.state.mode) === "remote") {
    return $t("providers.music_quiz.playback_summary_remote");
  }
  return playback?.venue_player_name
    ? $t("providers.music_quiz.playback_summary_venue", [
        playback.venue_player_name,
      ])
    : $t("providers.music_quiz.playback_venue");
});

const rows = computed<SettingRow[]>(() => {
  const state = props.state;
  const rows: SettingRow[] = [
    {
      label: $t("providers.music_quiz.game_settings_game"),
      value: $t(props.game.labelKey),
    },
  ];
  if (state.name) {
    rows.push({
      label: $t("providers.music_quiz.game_settings_name"),
      value: state.name,
    });
  }
  rows.push(
    {
      label: $t("providers.music_quiz.rounds"),
      value: String(state.round_count),
    },
    {
      label: $t("providers.music_quiz.answer_seconds"),
      value: String(state.answer_duration),
    },
  );
  if ("suggestion_count" in state) {
    rows.push({
      label: $t("providers.music_quiz.answer_choices"),
      value: String(state.suggestion_count),
    });
  }
  if (state.quiz_type === "trivia") {
    rows.push({
      label: $t("providers.music_quiz.question_language"),
      value: getLocaleDisplayName(
        state.language || "en",
        i18n.global.locale.value,
      ),
    });
    rows.push({
      label: $t("providers.music_quiz.play_revealed_songs"),
      // Off unless the game turned it on.
      value: yesNo(state.play_reveal_audio === true),
    });
  }
  if (state.quiz_type === "music_timeline") {
    rows.push(
      {
        label: $t("providers.music_quiz.timeline_artist_bonus"),
        value: $t(BONUS_MODE_KEYS[state.artist_bonus_mode]),
      },
      {
        label: $t("providers.music_quiz.timeline_title_bonus"),
        value: $t(BONUS_MODE_KEYS[state.title_bonus_mode]),
      },
    );
  }
  if (state.include_similar_music !== undefined) {
    rows.push({
      label: $t("providers.music_quiz.include_similar_music"),
      value: yesNo(state.include_similar_music),
    });
  }
  rows.push({
    label: $t("providers.music_quiz.playback_mode"),
    value: playbackText.value,
  });
  return rows;
});
</script>
