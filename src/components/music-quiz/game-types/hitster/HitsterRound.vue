<template>
  <Card class="overflow-hidden">
    <CardContent class="flex flex-col gap-4">
      <Button
        v-if="showReadyButton && phase === 'reveal'"
        class="w-full max-w-sm self-center"
        size="lg"
        :disabled="busy || isReady"
        @click="emit('ready')"
      >
        <Check class="size-4" />
        {{ readyLabel }}
      </Button>

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
            {{ $t("providers.music_quiz.hitster_listen_title") }}
          </h2>
          <p class="text-muted-foreground">
            {{ $t("providers.music_quiz.hitster_listen_description") }}
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
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  MusicQuizHitsterRound,
  MusicQuizPhase,
} from "@/composables/useMusicQuiz";
import { getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { AudioLines, Check, Music2 } from "@lucide/vue";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    phase: MusicQuizPhase;
    round: MusicQuizHitsterRound;
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
</script>
