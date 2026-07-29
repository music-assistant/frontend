<template>
  <Card
    data-testid="music-timeline-round"
    :data-compact="compact ? 'true' : undefined"
    class="overflow-hidden"
    :class="{ 'gap-0 py-3': compact }"
  >
    <CardContent
      class="flex flex-col"
      :class="compact ? 'gap-3 px-3 sm:px-4' : 'gap-4'"
    >
      <div
        v-if="phase === 'answering'"
        class="flex flex-col items-center text-center"
        :class="compact ? 'gap-2 py-2' : 'gap-3 py-4'"
      >
        <span
          class="bg-primary/10 text-primary grid place-items-center rounded-full"
          :class="compact ? 'size-12' : 'size-16'"
        >
          <AudioLines :class="compact ? 'size-6' : 'size-8'" />
        </span>
        <div>
          <h2 class="text-xl font-bold">
            {{ $t("providers.music_quiz.music_timeline_listen_title") }}
          </h2>
          <p class="text-muted-foreground">
            {{ $t("providers.music_quiz.music_timeline_listen_description") }}
          </p>
        </div>
      </div>

      <div
        v-else-if="phase === 'reveal' && revealedEntry"
        class="grid items-center gap-4"
        :class="
          compact
            ? 'sm:grid-cols-[minmax(5rem,8rem)_minmax(0,1fr)]'
            : 'sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)]'
        "
      >
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="`${revealedEntry.title} - ${revealedEntry.artist}`"
          class="bg-muted mx-auto aspect-square w-full object-cover"
          :class="compact ? 'max-w-32 rounded-lg' : 'max-w-56 rounded-xl'"
        />
        <div
          v-else
          class="bg-muted text-muted-foreground mx-auto grid aspect-square w-full place-items-center"
          :class="compact ? 'max-w-32 rounded-lg' : 'max-w-56 rounded-xl'"
          aria-hidden="true"
        >
          <Music2 :class="compact ? 'size-8' : 'size-12'" />
        </div>
        <div
          class="flex min-w-0 flex-col text-center sm:text-left"
          :class="compact ? 'gap-1' : 'gap-2'"
        >
          <Badge class="w-fit self-center sm:self-start">
            {{ revealedEntry.release_year }}
          </Badge>
          <h2
            class="font-black break-words"
            :class="compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'"
          >
            {{ revealedEntry.title }}
          </h2>
          <p
            class="text-muted-foreground break-words"
            :class="{ 'text-lg': !compact }"
          >
            {{ revealedEntry.artist }}
          </p>
        </div>
      </div>

      <div
        v-if="autoAdvanceText"
        class="bg-muted/40 text-muted-foreground flex items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold tabular-nums"
        :class="compact ? 'py-1.5' : 'py-2'"
        role="timer"
        :aria-label="autoAdvanceText"
        data-testid="music-timeline-auto-advance"
      >
        <Clock3 class="size-4" aria-hidden="true" />
        {{ autoAdvanceText }}
      </div>

      <Button
        v-if="showReadyButton && phase === 'reveal'"
        class="w-full max-w-sm self-center"
        size="lg"
        :disabled="busy || isReady"
        data-testid="music-timeline-ready"
        @click="emit('ready')"
      >
        <Check class="size-4" />
        {{ readyLabel }}
      </Button>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  MusicQuizTimelineRound,
  MusicQuizPhase,
} from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizRevealCountdown } from "@/composables/music-quiz/useMusicQuizRevealCountdown";
import { getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { AudioLines, Check, Clock3, Music2 } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    phase: MusicQuizPhase;
    round: MusicQuizTimelineRound;
    isFinalRound: boolean;
    busy?: boolean;
    isReady?: boolean;
    readyLabel?: string;
    showReadyButton?: boolean;
    compact?: boolean;
  }>(),
  {
    busy: false,
    isReady: false,
    readyLabel: "",
    showReadyButton: false,
    compact: false,
  },
);
const emit = defineEmits<{ ready: [] }>();

const revealedEntry = computed(() => props.round.revealed_entry);
const imageUrl = computed(() =>
  getMediaImageUrl(revealedEntry.value?.image_url ?? ""),
);
const { remainingLabel: autoAdvanceLabel } = useMusicQuizRevealCountdown({
  active: () =>
    props.phase === "reveal" && props.round.auto_advance_at !== null,
  autoAdvanceAt: () => props.round.auto_advance_at,
});
const autoAdvanceText = computed(() =>
  autoAdvanceLabel.value
    ? $t(
        props.isFinalRound
          ? "providers.music_quiz.final_results_in"
          : "providers.music_quiz.next_round_in",
        [autoAdvanceLabel.value],
      )
    : "",
);
</script>
