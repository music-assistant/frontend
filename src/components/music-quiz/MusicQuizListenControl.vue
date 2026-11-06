<template>
  <!-- Headphones toggle in the guest top bar, on every in-game screen. -->
  <Teleport defer to="#guest-header-actions">
    <Button
      v-if="canListenIn || isListeningIn || connecting"
      variant="ghost"
      size="icon"
      class="rounded-full"
      :class="{ 'bg-primary/15 text-primary': isListeningIn }"
      :disabled="busy || connecting"
      :aria-pressed="isListeningIn"
      :aria-label="labels.title"
      :title="
        connecting ? connectingLabel : isListeningIn ? labels.stop : labels.tap
      "
      data-testid="listen-toggle"
      @click="toggle"
    >
      <LoaderCircle v-if="connecting" class="size-5 animate-spin" />
      <Headphones v-else class="size-5" />
    </Button>
  </Teleport>

  <Dialog v-model:open="promptOpen">
    <DialogContent
      class="max-w-[calc(100%-2rem)] sm:max-w-sm"
      :show-close-button="false"
      data-testid="listen-prompt"
    >
      <DialogHeader class="items-center text-center">
        <span
          class="bg-primary/10 text-primary mb-2 grid size-14 place-items-center rounded-full"
          aria-hidden="true"
        >
          <Headphones class="size-7" />
        </span>
        <DialogTitle class="text-xl">
          {{ $t("providers.music_quiz.listen_prompt_title") }}
        </DialogTitle>
        <DialogDescription class="text-base">
          {{ $t("providers.music_quiz.listen_prompt_body") }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="flex-col gap-2 sm:flex-col">
        <!-- Until this phone can play, the button waits rather than failing. -->
        <Button
          size="lg"
          class="w-full"
          :disabled="busy || connecting"
          data-testid="listen-prompt-confirm"
          @click="confirm"
        >
          <template v-if="connecting">
            <LoaderCircle class="size-4 animate-spin" />
            {{ connectingLabel }}
          </template>
          <template v-else>
            <Headphones class="size-4" />
            {{ $t("providers.music_quiz.listen_prompt_confirm") }}
          </template>
        </Button>
        <Button
          size="lg"
          variant="ghost"
          class="w-full"
          data-testid="listen-prompt-later"
          @click="later"
        >
          {{ $t("providers.music_quiz.listen_prompt_later") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { ListenInLabels } from "@/components/ListenIn.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMusicQuizListenReady } from "@/composables/music-quiz/useMusicQuizListenReady";
import { useListenIn, type ListenInMode } from "@/composables/useListenIn";
import type { EventType } from "@/plugins/api/interfaces";
import { webPlayer } from "@/plugins/web_player";
import { $t } from "@/plugins/i18n";
import { Headphones, LoaderCircle } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

const ANSWER_KEY_PREFIX = "music-quiz-listen-answer:";

const props = defineProps<{
  mode?: ListenInMode;
  labels: ListenInLabels;
  recheckEvents?: EventType[];
  getErrorMessage?: (err: unknown, fallback: string) => string;
}>();

// One listen-in instance for both the prompt and the top-bar toggle, so they
// always agree on whether this device is listening.
const {
  canListenIn,
  isListeningIn,
  busy,
  enableListenIn,
  disableListenIn,
  checkCanListenIn,
} = useListenIn({
  domain: "music_quiz",
  mode: () => props.mode,
  notifyError: (message) => toast.error(message),
  errorMessages: {
    noWebPlayer: props.labels.errorNoWebPlayer,
    listenIn: props.labels.errorListenIn,
    stopListenIn: props.labels.errorStopListenIn,
  },
  recheckEvents: props.recheckEvents,
  getErrorMessage: props.getErrorMessage,
});

const promptOpen = ref(false);
let currentPlayerId: string | null = null;
// A "yes" from earlier, waiting for this phone to be allowed to listen.
let resumeWhenAllowed = false;
// Set when the question closes for us rather than by the player's choice;
// the close watcher below clears it.
let closingQuietly = false;

const { waiting, timedOut, restartWait } = useMusicQuizListenReady(
  checkCanListenIn,
  canListenIn,
);
// Only a remote game waits for this phone; in a venue the room speaker plays.
const connecting = computed(
  () => props.mode === "remote" && !isListeningIn.value && waiting.value,
);
const connectingLabel = computed(() =>
  $t("providers.music_quiz.listen_connecting"),
);

// The server said yes: pick up a "yes" given before this phone was ready.
watch(canListenIn, (allowed) => {
  if (allowed && resumeWhenAllowed && !isListeningIn.value) {
    resumeWhenAllowed = false;
    void enableListenIn();
  }
});
// No go-ahead in time: nothing to offer, so close without counting a no.
watch(timedOut, (out) => {
  if (!out || canListenIn.value) return;
  resumeWhenAllowed = false;
  if (promptOpen.value) {
    closingQuietly = true;
    promptOpen.value = false;
  }
});

type ListenAnswer = "yes" | "no";

function storedAnswer(playerId: string): ListenAnswer | null {
  try {
    const answer = sessionStorage.getItem(ANSWER_KEY_PREFIX + playerId);
    return answer === "yes" || answer === "no" ? answer : null;
  } catch {
    return null;
  }
}

function rememberAnswer(answer: ListenAnswer): void {
  if (!currentPlayerId) return;
  try {
    sessionStorage.setItem(ANSWER_KEY_PREFIX + currentPlayerId, answer);
  } catch {
    // Without storage the question may come back after a reload.
  }
}

/**
 * Called on join, and on Continue after a reload. Asks once per player
 * whether to play the music on this device; after a yes, a later Continue
 * turns listening straight back on (the tap counts as the phone's go-ahead).
 * Only remote games ask: in a venue the room's speaker plays it.
 */
async function askAfterJoin(playerId: string) {
  currentPlayerId = playerId;
  if (props.mode !== "remote" || isListeningIn.value) return;
  const answer = storedAnswer(playerId);
  if (answer === "no") return;
  if (!canListenIn.value) await checkCanListenIn();
  if (canListenIn.value) {
    if (answer === "yes") await enableListenIn();
    else promptOpen.value = true;
    return;
  }
  // Most likely still connecting: ask now, and the buttons wait for it.
  restartWait();
  if (answer === "yes") resumeWhenAllowed = true;
  else promptOpen.value = true;
}

async function confirm() {
  // The tap itself unlocks audio playback on phones.
  webPlayer.primeAudio();
  if (await enableListenIn()) {
    rememberAnswer("yes");
    promptOpen.value = false;
  }
}

function later() {
  rememberAnswer("no");
  promptOpen.value = false;
}

// Closing the question any other way (Escape, tapping outside) means not now.
watch(promptOpen, (open) => {
  if (closingQuietly) {
    closingQuietly = false;
    return;
  }
  if (!open && currentPlayerId && !storedAnswer(currentPlayerId)) {
    rememberAnswer("no");
  }
});

function toggle() {
  if (isListeningIn.value) {
    void disableListenIn();
  } else {
    webPlayer.primeAudio();
    void enableListenIn();
  }
}

defineExpose({ askAfterJoin, busy });
</script>
