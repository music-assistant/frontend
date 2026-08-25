<template>
  <audio ref="audioRef" class="hidden-audio"></audio>
  <audio
    ref="silentAudioRef"
    class="hidden-audio"
    :src="almostSilentMp3"
    loop
  ></audio>
</template>

<script setup lang="ts">
import { resolveActiveElapsedTime } from "@/helpers/activeElapsedTime";
import { useMediaBrowserMetaData } from "@/helpers/useMediaBrowserMetaData";
import { BrowserMediaControlsMode } from "@/helpers/device_settings";
import {
  isMediaSessionDisabled,
  resetMediaSession,
} from "@/helpers/mediaSession";
import { getDeviceName } from "@/plugins/api/helpers";
import { SendspinPlayer, Codec } from "@sendspin/sendspin-js";

import almostSilentMp3 from "@/assets/almost_silent.mp3";
import api from "@/plugins/api";
import authManager from "@/plugins/auth";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import {
  webPlayer,
  isPlaybackMode,
  registerWebPlayerAudioUnlock,
  clearWebPlayerAudioUnlock,
  WebPlayerMode,
} from "@/plugins/web_player";
import {
  prepareSendspinSession,
  isDirectConnection,
} from "@/plugins/sendspin-connection";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

// Properties
export interface Props {
  playerId: string;
}
const props = defineProps<Props>();
const route = useRoute();

// Versioned: delays saved before sendspin-js 4.0.0 dropped its 200ms default would replay early.
const SYNC_DELAY_STORAGE_KEY = "frontend.settings.sendspin_static_delay_v2";

const audioRef = ref<HTMLAudioElement>();
const silentAudioRef = ref<HTMLAudioElement>();

// Detect Android for MediaSession workaround
const isAndroid = /android/i.test(navigator.userAgent);
const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isMobileOutput = isAndroid || isIOS;

// Sendspin Player instance
let player: SendspinPlayer | null = null;
// Set on teardown, so a session that is still being prepared does not connect a
// player nothing owns.
let unmounted = false;

// iOS only lets audio start inside a user gesture, but listen-in audio starts
// asynchronously (after the server groups this player), so the library would
// otherwise unlock its audio outside the gesture and stay silent.
const primeAudio = () => {
  if (!isIOS) return true;
  if (!player) return false;
  void player.unlock().catch((error) => {
    console.debug("Sendspin: failed to prime audio for listen-in", error);
  });
  return true;
};

// Reactive state
const isPlaying = ref(false);
const volume = ref(100);
const muted = ref(false);
const playerState = ref<"synchronized" | "error">("synchronized");

// Watch for volume/mute changes from UI
watch(volume, (newVolume) => {
  if (player) {
    player.setVolume(newVolume);
  }
});

watch(muted, (newMuted) => {
  if (player) {
    player.setMuted(newMuted);
  }
});

// MediaSession setup for metadata - at top level for proper reactivity
let unsubMetadata: (() => void) | undefined;

// Interval to reset silent audio to avoid audible tone portion
let silentAudioInterval: number | undefined;

// Track seek position for accurate repeated seek forward/backward
let lastSeekPos: number | undefined;
let lastSeekPosTimeout: number | undefined;
const pauseCommandTimeouts = new Set<number>();

const resetLastSeekPos = () => {
  if (lastSeekPosTimeout) clearTimeout(lastSeekPosTimeout);
  lastSeekPosTimeout = window.setTimeout(() => {
    lastSeekPos = undefined;
    lastSeekPosTimeout = undefined;
  }, 2000);
};

// An undefined player ID makes the metadata helper follow the selected player.
const metadataPlayerId = computed(() =>
  webPlayer.browserControlsMode === BrowserMediaControlsMode.WEB_PLAYER
    ? props.playerId
    : undefined,
);
const mediaSessionDisabled = computed(
  () =>
    webPlayer.browserControlsMode === BrowserMediaControlsMode.DISABLED ||
    isMediaSessionDisabled(route, authManager.isGuestAccessSession()),
);

const correctionMode = computed(() => {
  // Only do the more precise but distorting "full" correction when grouped
  const thisPlayer = api.players[props.playerId];
  const isGrouped =
    thisPlayer && (thisPlayer.synced_to || thisPlayer.group_members.length > 0);
  return isGrouped ? "sync" : "quality-local";
});

// Subscribe to metadata immediately (doesn't require user interaction)
watch(
  [metadataPlayerId, mediaSessionDisabled],
  ([newPlayerId, disabled]) => {
    if (unsubMetadata) unsubMetadata();
    if (disabled) {
      resetMediaSession();
      unsubMetadata = undefined;
      return;
    }
    unsubMetadata = useMediaBrowserMetaData(newPlayerId);
  },
  { immediate: true },
);

watch(
  () => webPlayer.tabMode,
  () => {
    if (!mediaSessionDisabled.value) return;
    if (unsubMetadata) {
      unsubMetadata();
      unsubMetadata = undefined;
    }
    resetMediaSession();
  },
  { immediate: true },
);

watch(
  mediaSessionDisabled,
  (disabled) => {
    if (disabled) {
      resetMediaSession();
    } else {
      registerMediaSessionActionHandlers();
    }
  },
  { immediate: true },
);

watch(
  [
    () => store.activePlayer?.playback_state,
    mediaSessionDisabled,
    metadataPlayerId,
    () => webPlayer.interacted,
  ],
  ([state, disabled, targetPlayerId, interacted]) => {
    if (silentAudioInterval) {
      clearInterval(silentAudioInterval);
      silentAudioInterval = undefined;
    }
    if (disabled || targetPlayerId !== undefined || !interacted) {
      silentAudioRef.value?.pause();
      return;
    }
    if (!silentAudioRef.value) return;

    if (state === PlaybackState.PLAYING) {
      silentAudioRef.value.play().catch(() => {});
      // Reset to silent portion every 55 seconds to avoid audible tone on loop restart
      silentAudioInterval = window.setInterval(() => {
        if (silentAudioRef.value) silentAudioRef.value.currentTime = 2;
      }, 55000);
    } else if (state === PlaybackState.PAUSED) {
      silentAudioRef.value.pause();
      silentAudioRef.value.currentTime = 2; // Skip to silent portion
    } else {
      silentAudioRef.value.pause();
      silentAudioRef.value.currentTime = 2; // Skip to silent portion
    }
  },
  { immediate: true },
);

// Centralized watcher for playbackState - handles all state changes
watch(
  [
    isPlaying,
    playerState,
    () => store.activePlayer?.playback_state,
    metadataPlayerId,
    () => webPlayer.interacted,
    mediaSessionDisabled,
  ],
  ([, pState, , metaPlayerId, interacted, disabled]) => {
    if (disabled) {
      resetMediaSession();
      return;
    }
    if (!interacted) return;

    let state: MediaSessionPlaybackState;
    if (metaPlayerId !== undefined) {
      // Web player is the source - use isPlaying from library
      // Show as paused if player has error
      state = isPlaying.value && pState !== "error" ? "playing" : "paused";
    } else {
      // Active player is the source
      const activeState = store.activePlayer?.playback_state;
      if (activeState === PlaybackState.PLAYING) {
        state = "playing";
      } else if (activeState === PlaybackState.PAUSED) {
        state = "paused";
      } else {
        state = "none";
      }
    }
    navigator.mediaSession.playbackState = state;
  },
  { immediate: true },
);

watch(correctionMode, (mode) => {
  player?.setCorrectionMode(mode);
});

// Hand this client's pairing token to the server so it can pair us without an
// operator step. The server derives the client id from the token itself, and
// ignores the call once we are paired.
const registerPairing = () => {
  const pairingToken = player?.pairingToken;
  if (!pairingToken) return;
  api
    .sendCommand(
      "sendspin/pair_web_player",
      { pairing_token: pairingToken },
      { suppressGlobalError: true },
    )
    .catch((error) => console.warn("Sendspin: auto-pairing failed", error));
};

// Setup on mount
onMounted(() => {
  console.debug("Sendspin: Component mounted, connecting...");

  registerWebPlayerAudioUnlock(primeAudio);

  // If already showing active player metadata, play silent audio now that silentAudioRef exists
  if (
    metadataPlayerId.value === undefined &&
    !mediaSessionDisabled.value &&
    webPlayer.interacted &&
    silentAudioRef.value
  ) {
    silentAudioRef.value.play().catch(() => {});
  }

  // Create and initialize player
  if (audioRef.value) {
    const audioElement = isMobileOutput ? audioRef.value : undefined;

    const savedSyncDelay = localStorage.getItem(SYNC_DELAY_STORAGE_KEY);
    const parsed = savedSyncDelay !== null ? parseInt(savedSyncDelay, 10) : NaN;
    const syncDelay = isNaN(parsed) ? undefined : parsed;

    // Prepare session first, then create player with appropriate codecs
    prepareSendspinSession()
      .then(() => {
        if (unmounted) return;

        // Prefer opus for bandwidth efficiency, flac as fallback
        // (opus requires secure context which may not be available)
        const codecs: Codec[] = ["opus", "flac"];

        console.debug(
          `Sendspin: Using codecs [${codecs.join(", ")}] for ${isDirectConnection() ? "direct" : "remote"} connection`,
        );

        // Use a placeholder URL - the WebSocket interceptor will route through WebRTC
        // The URL just needs to be valid and contain "/sendspin" for the interceptor
        player = new SendspinPlayer({
          baseUrl: "http://sendspin.local",
          audioElement,
          clientName: getDeviceName(),
          // How the server recognizes us as its built-in player rather than a
          // third-party client that has to be paired by hand.
          productName: "Web Player",
          codecs,
          syncDelay,
          requiredLeadTimeMs: 250,
          // Startup lead the server uses to schedule the first chunk, so it
          // directly delays first audio and must stay small. Once playback is
          // running the buffer grows well beyond this on its own.
          minBufferMs: 500,
          onStateChange: (state) => {
            // Update reactive state when player state changes
            isPlaying.value = state.isPlaying;
            volume.value = state.volume;
            muted.value = state.muted;
            playerState.value = state.playerState;
          },
          correctionMode: correctionMode.value,
          onPairing: (event: string, detail?: string) =>
            console.debug(`Sendspin: pairing ${event}`, detail ?? ""),
          onDelayCommand: (delayMs: number) => {
            localStorage.setItem(SYNC_DELAY_STORAGE_KEY, String(delayMs));
          },
          // Recover a sendspin transport that drops on its own (e.g. its socket is
          // idle-timed-out while the main API connection stays up). Drops that also
          // take the main connection down are handled by the web player, which
          // tears this component down and remounts it on reconnect. The interceptor
          // rebuilds a fresh connection per attempt; retries are unbounded so
          // playback recovers whenever connectivity returns, and the loop is torn
          // down with the component on unmount.
          reconnect: {
            baseDelayMs: 1000,
            maxDelayMs: 30000,
            onReconnecting: (attempt: number) =>
              console.debug(`Sendspin: reconnecting (attempt ${attempt})`),
            // Re-pair after a reconnect: the server may have dropped our pairing
            // record in the meantime (guest pairings are removed on disconnect),
            // leaving the new connection unpaired. A no-op while still paired.
            onReconnected: () => {
              console.debug("Sendspin: reconnected");
              registerPairing();
            },
            onExhausted: () =>
              console.warn("Sendspin: reconnect attempts exhausted"),
          },
        });

        return player.connect().then(registerPairing);
      })
      .catch((error) => {
        console.error("Sendspin: Failed to connect", error);
      });
  }

  // Audio element event listeners for mobile MediaSession resilience
  if (audioRef.value) {
    // Ensure audio element doesn't stay paused after interruptions while stream should play
    audioRef.value.addEventListener("pause", () => {
      console.debug("Sendspin: Audio element paused");
      if (!isMobileOutput) return;

      const shouldBePlaying =
        isPlaying.value &&
        playerState.value !== "error" &&
        api.players[props.playerId]?.playback_state === PlaybackState.PLAYING;
      if (!shouldBePlaying || !audioRef.value) return;

      audioRef.value.play().catch((error) => {
        console.warn(
          "Sendspin: Failed to recover audio element playback:",
          error,
        );
      });
    });
  }
});

// Cleanup on unmount
onBeforeUnmount(() => {
  unmounted = true;
  clearWebPlayerAudioUnlock(primeAudio);
  if (player) {
    // The server holds a player registered for minutes after a "restart"
    // goodbye, which is what a hand-over to another tab needs. Once this
    // browser wants no player at all, say so instead, or it stays targetable
    // while nothing is listening.
    player.disconnect(
      isPlaybackMode(webPlayer.mode) ? "restart" : "user_request",
    );
    player = null;
  }
  if (unsubMetadata) unsubMetadata();
  if (silentAudioInterval) clearInterval(silentAudioInterval);
  if (lastSeekPosTimeout) clearTimeout(lastSeekPosTimeout);
  for (const timeout of pauseCommandTimeouts) clearTimeout(timeout);
  pauseCommandTimeouts.clear();
  if (
    mediaSessionDisabled.value ||
    webPlayer.browserControlsMode !== BrowserMediaControlsMode.ACTIVE_PLAYER ||
    webPlayer.tabMode !== WebPlayerMode.CONTROLS_ONLY
  ) {
    resetMediaSession();
  }
});

function getTargetPlayerId(): string | undefined {
  if (metadataPlayerId.value !== undefined) return props.playerId;
  return store.activePlayerId;
}

function registerMediaSessionActionHandlers(): void {
  navigator.mediaSession.setActionHandler("play", () => {
    const targetId = getTargetPlayerId();
    if (!targetId) return;
    api.playerCommandPlay(targetId);
  });

  navigator.mediaSession.setActionHandler("pause", () => {
    const targetId = getTargetPlayerId();
    if (!targetId) return;
    // Delay avoids Chromium sending pause when a computer enters standby.
    const timeout = window.setTimeout(() => {
      api.playerCommandPause(targetId);
      pauseCommandTimeouts.delete(timeout);
    }, 250);
    pauseCommandTimeouts.add(timeout);
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    const targetId = getTargetPlayerId();
    if (!targetId) return;
    api.playerCommandNext(targetId);
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    const targetId = getTargetPlayerId();
    if (!targetId) return;
    api.playerCommandPrevious(targetId);
  });

  navigator.mediaSession.setActionHandler("seekto", (evt) => {
    const targetId = getTargetPlayerId();
    if (!targetId || evt.seekTime == null) return;
    api.playerCommandSeek(targetId, Math.round(evt.seekTime));
  });

  // Implementing seek forward/backward hides prev/next buttons on iOS/Mac.
  if (!navigator.userAgent.match(/(iPhone|iPod|iPad|Mac)/i)) {
    navigator.mediaSession.setActionHandler("seekforward", (evt) => {
      const targetId = getTargetPlayerId();
      if (!targetId) return;
      const offset = evt.seekOffset || 10;
      const elapsed = lastSeekPos ?? resolveActiveElapsedTime(targetId);
      if (elapsed == null) return;
      const newPos = Math.round(elapsed + offset);
      lastSeekPos = newPos;
      resetLastSeekPos();
      api.playerCommandSeek(targetId, newPos);
    });

    navigator.mediaSession.setActionHandler("seekbackward", (evt) => {
      const targetId = getTargetPlayerId();
      if (!targetId) return;
      const offset = evt.seekOffset || 10;
      const elapsed = lastSeekPos ?? resolveActiveElapsedTime(targetId);
      if (elapsed == null) return;
      const newPos = Math.round(Math.max(0, elapsed - offset));
      lastSeekPos = newPos;
      resetLastSeekPos();
      api.playerCommandSeek(targetId, newPos);
    });
  }
}
</script>

<style lang="css">
.hidden-audio {
  width: 0;
  height: 0;
}
</style>
