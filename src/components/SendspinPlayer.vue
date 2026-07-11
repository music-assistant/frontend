<template>
  <audio ref="audioRef" controls class="hidden-audio"></audio>
  <audio
    ref="silentAudioRef"
    class="hidden-audio"
    :src="almostSilentMp3"
    loop
  ></audio>
</template>

<script setup lang="ts">
import { useMediaBrowserMetaData } from "@/helpers/useMediaBrowserMetaData";
import { resetMediaSession } from "@/helpers/mediaSession";
import { getDeviceName } from "@/plugins/api/helpers";
import { SendspinPlayer, Codec } from "@sendspin/sendspin-js";

import almostSilentMp3 from "@/assets/almost_silent.mp3";
import api from "@/plugins/api";
import authManager from "@/plugins/auth";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import {
  webPlayer,
  registerWebPlayerAudioUnlock,
  clearWebPlayerAudioUnlock,
  refreshBrowserMediaControls,
  WebPlayerMode,
} from "@/plugins/web_player";
import {
  prepareSendspinSession,
  isDirectConnection,
} from "@/plugins/sendspin-connection";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

// Properties
export interface Props {
  playerId: string;
}
const props = defineProps<Props>();

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

// Internal sendspin-js scheduler hooks used to unlock audio within a user
// gesture; the pinned 3.2.0 release exposes no public equivalent.
interface SendspinAudioUnlock {
  initAudioContext?: () => void;
  resumeAudioContext?: () => void | Promise<void>;
}

// iOS only lets audio start inside a user gesture, but listen-in audio starts
// asynchronously (after the server groups this player), so the library would
// create and resume its AudioContext outside the gesture and stay silent.
// Create and resume that context now, while the gesture is still active, so the
// stream plays reliably once it arrives.
const primeAudio = () => {
  if (!isIOS) return;
  try {
    const scheduler = (
      player as unknown as { scheduler?: SendspinAudioUnlock } | null
    )?.scheduler;
    scheduler?.initAudioContext?.();
    void scheduler?.resumeAudioContext?.();
  } catch (error) {
    console.debug("Sendspin: failed to prime audio for listen-in", error);
  }
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

// Determine which player's metadata to show:
// - Web player's metadata when it's playing
// - Selected player's metadata otherwise (undefined = uses store.activePlayerId)
const metadataPlayerId = computed(() => {
  const thisPlayer = api.players[props.playerId];
  if (thisPlayer?.playback_state === PlaybackState.PLAYING) {
    return props.playerId;
  }
  return undefined;
});

const correctionMode = computed(() => {
  // Only do the more precise but distorting "full" correction when grouped
  const thisPlayer = api.players[props.playerId];
  const isGrouped =
    thisPlayer && (thisPlayer.synced_to || thisPlayer.group_members.length > 0);
  return isGrouped ? "sync" : "quality-local";
});

// Subscribe to metadata immediately (doesn't require user interaction)
watch(
  metadataPlayerId,
  (newPlayerId) => {
    if (unsubMetadata) unsubMetadata();
    if (isReceiveOnlyGuest()) {
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
    if (!isReceiveOnlyGuest()) return;
    if (unsubMetadata) {
      unsubMetadata();
      unsubMetadata = undefined;
    }
    resetMediaSession();
  },
  { immediate: true },
);

// Control silent audio based on interaction and metadata target
watch(
  [metadataPlayerId, () => webPlayer.interacted],
  ([newPlayerId, interacted]) => {
    if (!interacted) return;

    // Stop silent audio when web player takes over
    if (newPlayerId !== undefined && silentAudioRef.value) {
      silentAudioRef.value.pause();
    }
  },
  { immediate: true },
);

// Watch active player's playback state to control silent audio
watch(
  () => store.activePlayer?.playback_state,
  (state) => {
    // Only control when showing active player metadata (not web player)
    if (metadataPlayerId.value !== undefined) return;
    if (isReceiveOnlyGuest()) return;
    if (!silentAudioRef.value) return;

    // Clear existing interval
    if (silentAudioInterval) {
      clearInterval(silentAudioInterval);
      silentAudioInterval = undefined;
    }

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
  ],
  ([, pState, , metaPlayerId, interacted]) => {
    if (isReceiveOnlyGuest()) {
      navigator.mediaSession.playbackState = "none";
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

// Setup on mount
onMounted(() => {
  console.debug("Sendspin: Component mounted, connecting...");

  registerWebPlayerAudioUnlock(primeAudio);

  // If already showing active player metadata, play silent audio now that silentAudioRef exists
  if (
    metadataPlayerId.value === undefined &&
    !isReceiveOnlyGuest() &&
    webPlayer.interacted &&
    silentAudioRef.value
  ) {
    silentAudioRef.value.play().catch(() => {});
  }

  // Create and initialize player
  if (audioRef.value) {
    const audioElement = isMobileOutput ? audioRef.value : undefined;

    const savedSyncDelay = localStorage.getItem(
      "frontend.settings.sendspin_static_delay",
    );
    const parsed = savedSyncDelay !== null ? parseInt(savedSyncDelay, 10) : NaN;
    const syncDelay = isNaN(parsed) ? undefined : parsed;

    // Prepare session first, then create player with appropriate codecs
    prepareSendspinSession()
      .then(() => {
        // Prefer opus for bandwidth efficiency, flac as fallback
        // (opus requires secure context which may not be available)
        const codecs: Codec[] = ["opus", "flac"];

        console.debug(
          `Sendspin: Using codecs [${codecs.join(", ")}] for ${isDirectConnection() ? "direct" : "remote"} connection`,
        );

        // Use a placeholder URL - the WebSocket interceptor will route through WebRTC
        // The URL just needs to be valid and contain "/sendspin" for the interceptor
        player = new SendspinPlayer({
          playerId: props.playerId,
          baseUrl: "http://sendspin.local",
          audioElement,
          clientName: getDeviceName(),
          codecs,
          syncDelay,
          requiredLeadTimeMs: 250,
          // Ask for a larger buffer when we are being routed through WebRTC.
          // This increases latency for live streams, but improves stability
          minBufferMs: isDirectConnection() ? 2500 : 6000,
          onStateChange: (state) => {
            // Update reactive state when player state changes
            isPlaying.value = state.isPlaying;
            volume.value = state.volume;
            muted.value = state.muted;
            playerState.value = state.playerState;
          },
          correctionMode: correctionMode.value,
          onDelayCommand: (delayMs: number) => {
            localStorage.setItem(
              "frontend.settings.sendspin_static_delay",
              String(delayMs),
            );
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
            onReconnected: () => console.debug("Sendspin: reconnected"),
            onExhausted: () =>
              console.warn("Sendspin: reconnect attempts exhausted"),
          },
        });

        return player.connect();
      })
      .catch((error) => {
        console.error("Sendspin: Failed to connect", error);
      });
  }

  if (isReceiveOnlyGuest()) {
    resetMediaSession();
  } else {
    registerMediaSessionActionHandlers();
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
  clearWebPlayerAudioUnlock(primeAudio);
  if (player) {
    player.disconnect();
    player = null;
  }
  if (unsubMetadata) unsubMetadata();
  if (silentAudioInterval) clearInterval(silentAudioInterval);
  if (lastSeekPosTimeout) clearTimeout(lastSeekPosTimeout);
  for (const timeout of pauseCommandTimeouts) clearTimeout(timeout);
  pauseCommandTimeouts.clear();
  resetMediaSession();
  if (
    !isReceiveOnlyGuest() &&
    webPlayer.tabMode === WebPlayerMode.CONTROLS_ONLY
  ) {
    refreshBrowserMediaControls();
  }
});

function isReceiveOnlyGuest(): boolean {
  return authManager.isPartyGuest() || authManager.isMusicQuizGuest();
}

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
    if (!targetId || !evt.seekTime) return;
    api.playerCommandSeek(targetId, Math.round(evt.seekTime));
  });

  // Implementing seek forward/backward hides prev/next buttons on iOS/Mac.
  if (!navigator.userAgent.match(/(iPhone|iPod|iPad|Mac)/i)) {
    navigator.mediaSession.setActionHandler("seekforward", (evt) => {
      const targetId = getTargetPlayerId();
      if (!targetId) return;
      const offset = evt.seekOffset || 10;
      const queueId = store.activePlayerQueue?.queue_id;
      const queueTime = queueId ? api.queueElapsedTime[queueId] : undefined;
      const elapsed = lastSeekPos ?? queueTime?.elapsed_time ?? 0;
      const newPos = Math.round(elapsed + offset);
      lastSeekPos = newPos;
      resetLastSeekPos();
      api.playerCommandSeek(targetId, newPos);
    });

    navigator.mediaSession.setActionHandler("seekbackward", (evt) => {
      const targetId = getTargetPlayerId();
      if (!targetId) return;
      const offset = evt.seekOffset || 10;
      const queueId = store.activePlayerQueue?.queue_id;
      const queueTime = queueId ? api.queueElapsedTime[queueId] : undefined;
      const elapsed = lastSeekPos ?? queueTime?.elapsed_time ?? 0;
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
