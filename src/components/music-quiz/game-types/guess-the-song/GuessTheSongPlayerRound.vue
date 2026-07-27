<template>
  <GuessTheSongReveal
    v-if="state.phase === 'reveal'"
    :round="currentRound"
    :busy="busy"
    :is-ready="state.you.ready"
    :ready-label="readyLabel"
    :image-url="currentRoundImageUrl"
    :show-lyrics="showRevealLyrics"
    :has-lyrics="hasRevealLyrics"
    :lyrics-loading="isRevealLyricsLoading"
    :lyrics="revealLyrics || ''"
    :lrc-lyrics="revealLrcLyrics || ''"
    :lyrics-position="lyricsPosition"
    lyrics-text-color="var(--foreground)"
    @ready="emit('ready')"
    @copy-title="copyCurrentRoundTitle"
  />
</template>

<script setup lang="ts">
import type {
  MusicQuizPlayerGameAdapterEmits,
  MusicQuizPlayerGameAdapterProps,
} from "@/components/music-quiz/adapter_contracts";
import GuessTheSongReveal from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongReveal.vue";
import { useGuessTheSongPlaybackPosition } from "@/components/music-quiz/game-types/guess-the-song/useGuessTheSongPlaybackPosition";
import type {
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
import api from "@/plugins/api";
import {
  MediaType,
  type MediaItemType,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, onScopeDispose, ref, watch } from "vue";
import { toast } from "vue-sonner";

const props =
  defineProps<
    MusicQuizPlayerGameAdapterProps<
      MusicQuizGuessTheSongPersonalizedState,
      MusicQuizGuessTheSongRound
    >
  >();
const emit = defineEmits<MusicQuizPlayerGameAdapterEmits>();

const revealLyrics = ref<string | null>(null);
const revealLrcLyrics = ref<string | null>(null);
const revealLyricsStatus = ref<
  "idle" | "loading" | "ready" | "empty" | "error"
>("idle");
let lyricsRequestCounter = 0;

const readyLabel = computed(() =>
  props.state.you.ready
    ? $t("providers.music_quiz.waiting_for_next")
    : $t("providers.music_quiz.ready"),
);
const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(props.currentRound.image_url ?? ""),
);
const hasRevealLyrics = computed(() => revealLyricsStatus.value === "ready");
const isRevealLyricsLoading = computed(
  () => revealLyricsStatus.value === "loading",
);
const showRevealLyrics = computed(() => revealLyricsStatus.value !== "error");

const { position: lyricsPosition } = useGuessTheSongPlaybackPosition({
  active: () =>
    props.state.phase === "reveal" && !!props.currentRound.track_uri,
  startedAt: () => props.currentRound.started_at,
  duration: () => props.currentRound.duration,
});

watch(
  () => [props.state.phase, props.currentRound.track_uri] as const,
  ([phase, trackUri]) => {
    if (phase !== "reveal" || !trackUri) {
      resetRevealLyrics();
      return;
    }
    void loadRevealLyrics(trackUri);
  },
  { immediate: true },
);

onScopeDispose(() => {
  lyricsRequestCounter += 1;
});

async function copyCurrentRoundTitle() {
  if (!props.currentRound.answer_label) return;
  const copied = await copyToClipboard(props.currentRound.answer_label);
  if (!copied) {
    toast.error($t("providers.music_quiz.copy_music_name_failed"));
  }
}

async function loadRevealLyrics(trackUri: string) {
  const requestId = ++lyricsRequestCounter;
  revealLyricsStatus.value = "loading";
  revealLyrics.value = null;
  revealLrcLyrics.value = null;
  try {
    const item = await api.getItemByUri(trackUri);
    if (requestId !== lyricsRequestCounter) return;
    if (!isTrack(item)) {
      revealLyricsStatus.value = "empty";
      return;
    }
    const [lyrics, lrcLyrics] = await api.getTrackLyrics(item);
    if (requestId !== lyricsRequestCounter) return;
    revealLyrics.value = lyrics;
    revealLrcLyrics.value = lrcLyrics;
    revealLyricsStatus.value =
      (lyrics ?? "").trim() || (lrcLyrics ?? "").trim() ? "ready" : "empty";
  } catch (error) {
    if (requestId === lyricsRequestCounter) {
      console.warn("Failed to load quiz lyrics:", error);
      revealLyricsStatus.value = "error";
    }
  }
}

function resetRevealLyrics() {
  lyricsRequestCounter += 1;
  revealLyrics.value = null;
  revealLrcLyrics.value = null;
  revealLyricsStatus.value = "idle";
}

function isTrack(item: MediaItemType): item is Track {
  return item.media_type === MediaType.TRACK;
}
</script>
