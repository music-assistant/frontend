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
import { SendspinPlayer, Codec } from "@music-assistant/sendspin-js";
import almostSilentMp3 from "@/assets/almost_silent.mp3";
import api from "@/plugins/api";
import { PlaybackState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer, WebPlayerMode } from "@/plugins/web_player";
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

// Watch and re-subscribe when the target player changes
// Also watch webPlayer.interacted to wait for user interaction
watch(
  [metadataPlayerId, () => webPlayer.interacted],
  ([newPlayerId, interacted]) => {
    if (!interacted) return;

    if (unsubMetadata) unsubMetadata();
    unsubMetadata = useMediaBrowserMetaData(newPlayerId);

    // Stop silent audio when web player takes over
    if (newPlayerId !== undefined && silentAudioRef.value) {
      silentAudioRef.value.pause();
    }
  },
  { immediate: true },
);

// Watch active player's playback state to control silent audio and mediaSession.playbackState
watch(
  () => store.activePlayer?.playback_state,
  (state) => {
    // Only control when showing active player metadata (not web player)
    if (metadataPlayerId.value !== undefined) return;
    if (!silentAudioRef.value) return;

    if (state === PlaybackState.PLAYING) {
      silentAudioRef.value.play().catch(() => {});
      navigator.mediaSession.playbackState = "playing";
    } else if (state === PlaybackState.PAUSED) {
      silentAudioRef.value.pause();
      navigator.mediaSession.playbackState = "paused";
    } else {
      silentAudioRef.value.pause();
      navigator.mediaSession.playbackState = "none";
    }
  },
  { immediate: true },
);

// Setup on mount
onMounted(() => {
  console.log("Sendspin: Component mounted, connecting...");

  // Set audio source to indicate this tab is handling audio
  // (for coordination with other tabs via web_player.ts)
  webPlayer.audioSource = WebPlayerMode.SENDSPIN;

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
        // Select codecs based on connection type:
        // - Direct (local WebSocket): opus + flac for quality
        // - Remote (WebRTC): opus only for bandwidth efficiency
        const codecs: Codec[] = isDirectConnection()
          ? ["opus", "flac"]
          : ["opus"];

        console.log(
          `Sendspin: Using codecs [${codecs.join(", ")}] for ${isDirectConnection() ? "direct" : "remote"} connection`,
        );

        // Use a placeholder URL - the WebSocket interceptor will route through WebRTC
        // The URL just needs to be valid and contain "/sendspin" for the interceptor
        player = new SendspinPlayer({
          playerId: props.playerId,
          baseUrl: "http://sendspin.local",
          // Web player config
          audioOutputMode: "media-element",
          audioElement,
          isAndroid,
          silentAudioSrc: almostSilentMp3,
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
        });

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
    api.playerCommandPause(targetId);
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    const targetId = getTargetPlayerId();
    if (!targetId) return;
    // workaround-alert: delay the pause command a tiny bit
    // to workaround a browser bug where pause is sent if a laptop/computer
    // goes to standby (lid closed). This issue seems to only exist on Chromium based browsers.
    setTimeout(() => {
      api.playerCommandNext(targetId);
    }, 250);
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    const targetId = getTargetPlayerId();
    if (!targetId) return;
    api.playerCommandPrevious(targetId);
  });

  // Audio element event listeners for Android MediaSession
  if (audioRef.value) {
    // Ensure audio element doesn't pause unexpectedly
    audioRef.value.addEventListener("pause", () => {
      console.log("Sendspin: Audio element paused");
      if (isAndroid) {
        // On Android, ALWAYS keep the silent loop playing to maintain MediaSession
        console.log("Sendspin: Restarting silent loop (Android workaround)");
        if (audioRef.value) {
          audioRef.value.play().catch((e) => {
            console.warn("Sendspin: Failed to restart silent loop:", e);
          });
        }
      } else {
        // On iOS/Desktop with MediaStream, restart only if playing
        if (isPlaying.value && audioRef.value) {
          console.log("Sendspin: Restarting audio element playback");
          audioRef.value.play().catch((e) => {
            console.warn("Sendspin: Failed to restart audio:", e);
          });
        } else {
          // Update playbackState when legitimately paused
          navigator.mediaSession.playbackState = "paused";
        }
      }
    });

    audioRef.value.addEventListener("playing", () => {
      console.log("Sendspin: Audio element playing");
      // Explicitly set playbackState when audio starts playing
      if (isPlaying.value) {
        navigator.mediaSession.playbackState = "playing";
      }
    });

    audioRef.value.addEventListener("ended", () => {
      console.log("Sendspin: Audio element ended");
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
});
</script>

<style lang="css">
.hidden-audio {
  width: 0;
  height: 0;
}
</style>
