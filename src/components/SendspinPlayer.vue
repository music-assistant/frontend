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
import { getSendspinDefaultSyncDelay } from "@/helpers/utils";
import { getDeviceName } from "@/plugins/api/helpers";
import { SendspinPlayer, Codec } from "@sendspin/sendspin-js";

import almostSilentMp3 from "@/assets/almost_silent.mp3";
import api from "@/plugins/api";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
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

// Sendspin Player instance
let player: SendspinPlayer | null = null;

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
    unsubMetadata = useMediaBrowserMetaData(newPlayerId);
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

  // If already showing active player metadata, play silent audio now that silentAudioRef exists
  if (
    metadataPlayerId.value === undefined &&
    webPlayer.interacted &&
    silentAudioRef.value
  ) {
    silentAudioRef.value.play().catch(() => {});
  }

  // Create and initialize player
  if (audioRef.value) {
    const audioElement = audioRef.value;

    const defaultSyncDelay = getSendspinDefaultSyncDelay();
    const syncDelay = parseInt(
      localStorage.getItem("frontend.settings.sendspin_sync_delay") ||
        String(defaultSyncDelay),
      10,
    );

    // Output latency compensation - enabled by default
    const storedOutputLatency = localStorage.getItem(
      "frontend.settings.sendspin_output_latency_compensation",
    );
    const useOutputLatencyCompensation =
      storedOutputLatency !== null ? storedOutputLatency === "true" : true;

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
          useOutputLatencyCompensation,
          onStateChange: (state) => {
            // Update reactive state when player state changes
            isPlaying.value = state.isPlaying;
            volume.value = state.volume;
            muted.value = state.muted;
            playerState.value = state.playerState;
          },
          correctionMode: correctionMode.value,
        });

        // Register callback for real-time sync delay changes from settings
        webPlayer.onSyncDelayChange = (delay) => player?.setSyncDelay(delay);

        return player.connect();
      })
      .catch((error) => {
        console.error("Sendspin: Failed to connect", error);
      });
  }

  // MediaSession setup for browser controls
  // Commands go to the player whose metadata is being shown
  const getTargetPlayerId = () => {
    // If web player is playing, target it; otherwise target the active player
    return metadataPlayerId.value !== undefined
      ? props.playerId
      : store.activePlayerId;
  };

  navigator.mediaSession.setActionHandler("play", () => {
    const targetId = getTargetPlayerId();
    if (!targetId) return;
    api.playerCommandPlay(targetId);
  });

  navigator.mediaSession.setActionHandler("pause", () => {
    const targetId = getTargetPlayerId();
    if (!targetId) return;
    // workaround-alert: delay the pause command a tiny bit
    // to workaround a browser bug where pause is sent if a laptop/computer
    // goes to standby (lid closed). This issue seems to only exist on Chromium based browsers.
    setTimeout(() => {
      api.playerCommandPause(targetId);
    }, 250);
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

  // Implementing seek forward/backward hides prev/next buttons on iOS/Mac
  if (!navigator.userAgent.match(/(iPhone|iPod|iPad|Mac)/i)) {
    navigator.mediaSession.setActionHandler("seekforward", (evt) => {
      const targetId = getTargetPlayerId();
      if (!targetId) return;
      const offset = evt.seekOffset || 10;
      const elapsed = lastSeekPos ?? store.activePlayerQueue?.elapsed_time ?? 0;
      const newPos = Math.round(elapsed + offset);
      lastSeekPos = newPos;
      resetLastSeekPos();
      api.playerCommandSeek(targetId, newPos);
    });

    navigator.mediaSession.setActionHandler("seekbackward", (evt) => {
      const targetId = getTargetPlayerId();
      if (!targetId) return;
      const offset = evt.seekOffset || 10;
      const elapsed = lastSeekPos ?? store.activePlayerQueue?.elapsed_time ?? 0;
      const newPos = Math.round(Math.max(0, elapsed - offset));
      lastSeekPos = newPos;
      resetLastSeekPos();
      api.playerCommandSeek(targetId, newPos);
    });
  }

  // Audio element event listeners for Android MediaSession
  if (audioRef.value) {
    // Ensure audio element doesn't pause unexpectedly
    audioRef.value.addEventListener("pause", () => {
      console.debug("Sendspin: Audio element paused");
      if (isAndroid) {
        // On Android, ALWAYS keep the silent loop playing to maintain MediaSession
        console.debug("Sendspin: Restarting silent loop (Android workaround)");
        if (audioRef.value) {
          audioRef.value.play().catch((e) => {
            console.warn("Sendspin: Failed to restart silent loop:", e);
          });
        }
      } else {
        // On iOS/Desktop with MediaStream, restart only if playing
        if (isPlaying.value && audioRef.value) {
          console.debug("Sendspin: Restarting audio element playback");
          audioRef.value.play().catch((e) => {
            console.warn("Sendspin: Failed to restart audio:", e);
          });
        }
      }
    });
  }
});

// Cleanup on unmount
onBeforeUnmount(() => {
  if (player) {
    player.disconnect();
    player = null;
  }
  if (unsubMetadata) unsubMetadata();
  if (silentAudioInterval) clearInterval(silentAudioInterval);
  webPlayer.onSyncDelayChange = null;

  // Clear MediaSession state
  navigator.mediaSession.metadata = null;
  navigator.mediaSession.setPositionState();
  navigator.mediaSession.playbackState = "none";
});
</script>

<style lang="css">
.hidden-audio {
  width: 0;
  height: 0;
}
</style>
