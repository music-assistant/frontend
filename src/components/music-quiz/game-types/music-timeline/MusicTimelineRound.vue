<template>
  <Card class="overflow-hidden">
    <CardContent class="flex flex-col gap-4">
      <div
        v-if="phase === 'answering'"
        class="flex flex-col items-center gap-3 py-4 text-center"
      >
        <span
          class="bg-primary/10 text-primary grid size-16 place-items-center rounded-full"
        >
          <AudioLines class="size-8" />
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
        class="grid items-center gap-4 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)]"
      >
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="`${revealedEntry.title} - ${revealedEntry.artist}`"
          class="bg-muted mx-auto aspect-square w-full max-w-56 rounded-xl object-cover"
        />
        <div
          v-else
          class="bg-muted text-muted-foreground mx-auto grid aspect-square w-full max-w-56 place-items-center rounded-xl"
          aria-hidden="true"
        >
          <Music2 class="size-12" />
        </div>
        <div class="flex min-w-0 flex-col gap-2 text-center sm:text-left">
          <Badge class="w-fit self-center sm:self-start">
            {{ revealedEntry.release_year }}
          </Badge>
          <h2 class="text-2xl font-black break-words sm:text-3xl">
            {{ revealedEntry.title }}
          </h2>
          <p class="text-muted-foreground text-lg break-words">
            {{ revealedEntry.artist }}
          </p>
        </div>
      </div>

      <div
        v-if="autoAdvanceText"
        class="bg-muted/40 text-muted-foreground flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums"
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
} from "@/composables/useMusicQuiz";
import { useMusicQuizAnswerDeadline } from "@/composables/useMusicQuizAnswerDeadline";
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
  }>(),
  {
    busy: false,
    isReady: false,
    readyLabel: "",
    showReadyButton: false,
  },
);
const emit = defineEmits<{ ready: [] }>();

const revealedEntry = computed(() => props.round.revealed_entry);
const imageUrl = computed(() =>
  getMediaImageUrl(revealedEntry.value?.image_url ?? ""),
);
const { remainingLabel: autoAdvanceLabel } = useMusicQuizAnswerDeadline({
  active: () =>
    props.phase === "reveal" && props.round.auto_advance_at !== null,
  deadline: () => props.round.auto_advance_at,
  duration: () => null,
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
