<template>
  <audio ref="audioRef" controls class="hidden-audio"></audio>
</template>

<script setup lang="ts">
import { useMediaBrowserMetaData } from "@/helpers/useMediaBrowserMetaData";
import { getSendspinDefaultSyncDelay } from "@/helpers/utils";
import { getDeviceName } from "@/plugins/api/helpers";
import { SendspinPlayer } from "@music-assistant/sendspin-js";
import almostSilentMp3 from "@/assets/almost_silent.mp3";
import api from "@/plugins/api";
import { webPlayer, WebPlayerMode } from "@/plugins/web_player";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

// Properties
export interface Props {
  playerId: string;
}
const props = defineProps<Props>();

const audioRef = ref<HTMLAudioElement>();

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

// MediaSession setup for metadata
let unsubMetadata: (() => void) | undefined;

// Setup on mount
onMounted(() => {
  console.log("Sendspin: Component mounted, connecting...");

  // Set audio source to indicate this tab is handling audio
  // (for coordination with other tabs via web_player.ts)
  webPlayer.audioSource = WebPlayerMode.SENDSPIN;

  // Setup metadata listener for MediaSession
  unsubMetadata = useMediaBrowserMetaData(props.playerId);

  // Create and initialize player
  if (audioRef.value) {
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

    player = new SendspinPlayer({
      playerId: props.playerId,
      baseUrl: webPlayer.baseUrl,
      // Web player config
      audioOutputMode: "media-element",
      audioElement: audioRef.value,
      isAndroid,
      silentAudioSrc: almostSilentMp3,
      clientName: getDeviceName(),
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

    // Connect to Sendspin server
    player.connect().catch((error) => {
      console.error("Sendspin: Failed to connect", error);
    });
  }

  // MediaSession setup for browser controls
  // These forward to Music Assistant player commands (not Sendspin-specific)
  navigator.mediaSession.setActionHandler("play", () => {
    if (!props.playerId) return;
    api.playerCommandPlay(props.playerId);
  });

  navigator.mediaSession.setActionHandler("pause", () => {
    if (!props.playerId) return;
    api.playerCommandPause(props.playerId);
  });

  navigator.mediaSession.setActionHandler("nexttrack", () => {
    if (!props.playerId) return;
    api.playerCommandNext(props.playerId);
  });

  navigator.mediaSession.setActionHandler("previoustrack", () => {
    if (!props.playerId) return;
    api.playerCommandPrevious(props.playerId);
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
