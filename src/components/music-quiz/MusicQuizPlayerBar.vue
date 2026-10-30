<template>
  <!-- Replaces the app's player bar on the host page: it shows where the quiz
       plays, never the song, so it can't spoil a round or show a stale track. -->
  <div
    class="bg-background/95 sticky bottom-0 z-20 -mx-4 mt-auto -mb-4 flex items-center gap-3 border-t px-4 py-2 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5"
    role="region"
    :aria-label="$t('providers.music_quiz.quiz_bar_label')"
    data-testid="music-quiz-player-bar"
  >
    <span
      class="grid size-9 shrink-0 place-items-center rounded-md"
      :class="
        unavailable
          ? 'bg-destructive/10 text-destructive'
          : 'bg-primary/10 text-primary'
      "
      aria-hidden="true"
    >
      <component :is="icon" class="size-5" />
    </span>
    <p
      class="min-w-0 flex-1 text-sm font-medium"
      :class="['line-clamp-2', { 'text-destructive': unavailable }]"
      role="status"
    >
      {{ statusText }}
    </p>

    <!-- Remote mode: the host can hear the game here too. -->
    <Button
      v-if="hostListen"
      :variant="isListeningIn ? 'secondary' : 'outline'"
      size="sm"
      class="shrink-0"
      :disabled="busy || connecting"
      :aria-pressed="isListeningIn"
      :aria-label="listenLabel"
      :title="listenLabel"
      data-testid="music-quiz-player-bar-listen"
      @click="toggleListen"
    >
      <LoaderCircle v-if="connecting" class="size-4 animate-spin" />
      <Headphones v-else class="size-4" />
      <span class="hidden sm:inline">{{ listenLabel }}</span>
    </Button>

    <template v-if="speaker && !unavailable">
      <Button
        variant="ghost"
        size="icon"
        :aria-label="isPlaying ? $t('pause') : $t('play')"
        :title="isPlaying ? $t('pause') : $t('play')"
        data-testid="music-quiz-player-bar-play"
        @click="togglePlay"
      >
        <Pause v-if="isPlaying" class="size-5" />
        <Play v-else class="size-5" />
      </Button>
      <!-- The draft follows the drag; the volume is sent when it's let go. -->
      <Slider
        class="w-24 shrink-0 sm:w-36"
        :model-value="[volumeDraft ?? speaker.volume_level ?? 0]"
        :max="100"
        :step="1"
        :thumb-label="$t('volume')"
        @update:model-value="volumeDraft = $event?.[0] ?? null"
        @value-commit="setVolume"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { quizPlayerBarShown } from "@/components/music-quiz/quizPlayerBarShown";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { MusicQuizSupportedHostState } from "@/composables/music-quiz/useMusicQuiz";
import { useMusicQuizListenReady } from "@/composables/music-quiz/useMusicQuizListenReady";
import { useListenIn } from "@/composables/useListenIn";
import { getMusicQuizErrorMessage } from "@/helpers/music_quiz";
import api from "@/plugins/api";
import { EventType, PlaybackState } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { webPlayer } from "@/plugins/web_player";
import {
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Smartphone,
  Speaker,
  TriangleAlert,
} from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{ state: MusicQuizSupportedHostState }>();

const speakerId = computed(() =>
  props.state.mode === "venue"
    ? (props.state.playback?.venue_player_id ?? null)
    : null,
);
const speaker = computed(() =>
  speakerId.value ? api.players[speakerId.value] : undefined,
);
const speakerName = computed(
  () => props.state.playback?.venue_player_name ?? speaker.value?.name ?? "",
);
// A venue game whose speaker went away can't play its rounds; say so. Once
// the player list has loaded, a speaker missing from it counts as gone too.
const unavailable = computed(() => {
  if (!speakerId.value) return false;
  if (speaker.value) return speaker.value.available === false;
  return Object.keys(api.players).length > 0;
});
const volumeDraft = ref<number | null>(null);

onMounted(() => {
  quizPlayerBarShown.value = true;
});
onBeforeUnmount(() => {
  quizPlayerBarShown.value = false;
});
const isPlaying = computed(
  () => speaker.value?.playback_state === PlaybackState.PLAYING,
);

const icon = computed(() => {
  if (unavailable.value) return TriangleAlert;
  if (props.state.mode !== "remote") return Speaker;
  // A phone for "their own devices"; the headphones are the listen button.
  return Smartphone;
});
const statusText = computed(() => {
  if (props.state.mode === "remote") {
    return $t("providers.music_quiz.quiz_bar_remote");
  }
  // Without a speaker name, it's just "the venue speaker".
  const name = speakerName.value || $t("providers.music_quiz.playback_venue");
  if (unavailable.value) {
    return $t("providers.music_quiz.quiz_bar_unavailable", [name]);
  }
  return speakerName.value
    ? $t("providers.music_quiz.quiz_bar_playing_on", [name])
    : name;
});

// Listening in, as players' phones do, is how the host hears a remote game
// on this device: the server can't use a browser as the game's speaker.
const {
  canListenIn,
  isListeningIn,
  busy,
  enableListenIn,
  disableListenIn,
  checkCanListenIn,
} = useListenIn({
  domain: "music_quiz",
  mode: () => props.state.mode,
  notifyError: (message) => toast.error(message),
  errorMessages: {
    noWebPlayer: $t("providers.music_quiz.error_no_web_player"),
    listenIn: $t("providers.music_quiz.error_listen_in"),
    stopListenIn: $t("providers.music_quiz.error_stop_listen_in"),
  },
  recheckEvents: [EventType.PROVIDER_EVENT],
  getErrorMessage: getMusicQuizErrorMessage,
});
const { waiting } = useMusicQuizListenReady(checkCanListenIn, canListenIn);
const connecting = computed(() => waiting.value && !isListeningIn.value);
const hostListen = computed(
  () =>
    props.state.mode === "remote" &&
    (canListenIn.value || isListeningIn.value || connecting.value),
);
const listenLabel = computed(() => {
  if (connecting.value) return $t("providers.music_quiz.listen_connecting");
  return $t(
    isListeningIn.value
      ? "providers.music_quiz.quiz_bar_stop_listening"
      : "providers.music_quiz.quiz_bar_listen_here",
  );
});

function toggleListen() {
  if (isListeningIn.value) {
    void disableListenIn();
  } else {
    // The tap itself unlocks audio playback on phones.
    webPlayer.primeAudio();
    void enableListenIn();
  }
}

async function togglePlay() {
  if (!speakerId.value) return;
  try {
    await api.playerCommandPlayPause(speakerId.value);
  } catch {
    toast.error($t("providers.music_quiz.quiz_bar_error"));
  }
}

async function setVolume(value: number[] | undefined) {
  if (!speakerId.value || !value?.length) return;
  try {
    await api.playerCommandVolumeSet(speakerId.value, value[0]);
  } catch {
    toast.error($t("providers.music_quiz.quiz_bar_error"));
  } finally {
    volumeDraft.value = null;
  }
}
</script>
