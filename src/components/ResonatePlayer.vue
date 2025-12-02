<template>
  <audio ref="audioRef" controls class="hidden-audio"></audio>
</template>

<script setup lang="ts">
import { useMediaBrowserMetaData } from "@/helpers/useMediaBrowserMetaData";
import { ResonatePlayer } from "@music-assistant/resonate-js";
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

// Resonate Player instance
let player: ResonatePlayer | null = null;

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
  console.log("Resonate: Component mounted, connecting...");

  // Set audio source to indicate this tab is handling audio
  // (for coordination with other tabs via web_player.ts)
  webPlayer.audioSource = WebPlayerMode.RESONATE;

  // Setup metadata listener for MediaSession
  unsubMetadata = useMediaBrowserMetaData(props.playerId);

  // Create and initialize player
  if (audioRef.value) {
    player = new ResonatePlayer({
      playerId: props.playerId,
      baseUrl: webPlayer.baseUrl,
      // Web player config
      audioOutputMode: "media-element",
      audioElement: audioRef.value,
      isAndroid,
      silentAudioSrc: almostSilentMp3,
      clientName: "Music Assistant Web Player",
      onStateChange: (state) => {
        // Update reactive state when player state changes
        isPlaying.value = state.isPlaying;
        volume.value = state.volume;
        muted.value = state.muted;
        playerState.value = state.playerState;
      },
    });

    // Connect to Resonate server
    player.connect().catch((error) => {
      console.error("Resonate: Failed to connect", error);
    });
  }

  // MediaSession setup for browser controls
  // These forward to Music Assistant player commands (not Resonate-specific)
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
      console.log("Resonate: Audio element paused");
      if (isAndroid) {
        // On Android, ALWAYS keep the silent loop playing to maintain MediaSession
        console.log("Resonate: Restarting silent loop (Android workaround)");
        if (audioRef.value) {
          audioRef.value.play().catch((e) => {
            console.warn("Resonate: Failed to restart silent loop:", e);
          });
        }
      } else {
        // On iOS/Desktop with MediaStream, restart only if playing
        if (isPlaying.value && audioRef.value) {
          console.log("Resonate: Restarting audio element playback");
          audioRef.value.play().catch((e) => {
            console.warn("Resonate: Failed to restart audio:", e);
          });
        } else {
          // Update playbackState when legitimately paused
          navigator.mediaSession.playbackState = "paused";
        }
      }
    });

    audioRef.value.addEventListener("playing", () => {
      console.log("Resonate: Audio element playing");
      // Explicitly set playbackState when audio starts playing
      if (isPlaying.value) {
        navigator.mediaSession.playbackState = "playing";
      }
    });

    audioRef.value.addEventListener("ended", () => {
      console.log("Resonate: Audio element ended");
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
