<template>
  <audio ref="audioRef" controls class="builtin-player" preload="metadata"></audio>
  <audio ref="nextAudioRef" class="builtin-player" preload="auto"></audio>
</template>

<script setup lang="ts">
import { useMediaBrowserMetaData } from "@/helpers/useMediaBrowserMetaData";
import api from "@/plugins/api";
import {
  BuiltinPlayerEventType,
  BuiltinPlayerEvent,
  EventMessage,
  EventType,
} from "@/plugins/api/interfaces";
import { webPlayer, WebPlayerMode } from "@/plugins/web_player";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

// properties
export interface Props {
  // This stays constant during the lifetime of this component
  playerId: string;
}
const props = defineProps<Props>();

const audioRef = ref<HTMLAudioElement>();
const nextAudioRef = ref<HTMLAudioElement>();

let playing = ref<boolean>();
let nextTrackPreloaded = ref<boolean>(false);
let preloadedNextItemId = ref<string | undefined>(undefined);
let currentItemId = ref<string | undefined>(undefined);

/**
 * Get the stream server URL (different from main API server).
 * The stream server runs on port 8097 by default.
 */
const getStreamServerUrl = function(): string {
  const baseUrl = new URL(webPlayer.baseUrl);
  baseUrl.port = '8097';
  return baseUrl.toString().replace(/\/$/, '');
};

/**
 * Preload the next track in the background for instant playback.
 * Uses a hidden audio element to download and parse the next track
 * while the current track is playing.
 */
const preloadNextTrack = async function(queueId: string) {
  if (!nextAudioRef.value) return;

  const queue = api.queues[queueId];
  if (!queue || !queue.next_item) {
    nextTrackPreloaded.value = false;
    preloadedNextItemId.value = undefined;
    return;
  }

  // Check if we've already preloaded this track
  if (preloadedNextItemId.value === queue.next_item.queue_item_id) {
    return;
  }

  // Use the /preload endpoint on the stream server
  const streamServerUrl = getStreamServerUrl();
  const streamUrl = `${streamServerUrl}/preload/${queueId}/${queue.next_item.queue_item_id}.mp3`;

  nextAudioRef.value.src = streamUrl;
  nextAudioRef.value.load();
  preloadedNextItemId.value = queue.next_item.queue_item_id;
  nextTrackPreloaded.value = true;
};

/**
 * Swap to the preloaded track for instant playback.
 * Swaps the audio element references so the preloaded track becomes active.
 */
const swapToPreloadedTrack = async function() {
  if (!audioRef.value || !nextAudioRef.value || !nextTrackPreloaded.value) {
    return false;
  }

  // Stop current audio
  audioRef.value.pause();

  // Swap the audio element references
  const temp = audioRef.value;
  audioRef.value = nextAudioRef.value;
  nextAudioRef.value = temp;

  // Clear the old (now next) audio element
  nextAudioRef.value.src = "";
  nextTrackPreloaded.value = false;
  preloadedNextItemId.value = undefined;

  // Play the preloaded track
  await audioRef.value.play();
  playing.value = true;

  return true;
};

const unsub = api.subscribe(
  EventType.BUILTIN_PLAYER,
  async (evt: EventMessage) => {
    if (!audioRef.value || !evt.data) return;
    const data = evt.data as BuiltinPlayerEvent;
    if (data.type === BuiltinPlayerEventType.PAUSE) {
      audioRef.value.pause();
      playing.value = false;
    } else if (data.type === BuiltinPlayerEventType.MUTE) {
      audioRef.value.muted = true;
    } else if (data.type === BuiltinPlayerEventType.UNMUTE) {
      audioRef.value.muted = false;
    } else if (data.type === BuiltinPlayerEventType.PLAY) {
      await audioRef.value.play();
      playing.value = true;
    } else if (data.type === BuiltinPlayerEventType.SET_VOLUME) {
      audioRef.value.volume = data.volume! / 100;
    } else if (data.type === BuiltinPlayerEventType.PLAY_MEDIA) {
      // Check if we're playing the preloaded next track
      const queue = api.queues[props.playerId];
      const newItemId = queue?.current_item?.queue_item_id;
      const isPlayingPreloadedTrack = nextTrackPreloaded.value &&
                                      preloadedNextItemId.value === newItemId &&
                                      newItemId !== currentItemId.value;

      if (isPlayingPreloadedTrack) {
        // Use the preloaded track for instant playback
        currentItemId.value = newItemId;
        await swapToPreloadedTrack();
        // Start preloading the new next track
        preloadNextTrack(props.playerId);
      } else {
        // Normal playback flow - load and play the track
        currentItemId.value = newItemId;
        audioRef.value.src = "";
        audioRef.value.src = `${webPlayer.baseUrl}/${data.media_url}`;
        await audioRef.value.play();
        playing.value = true;
      }
    } else if (data.type === BuiltinPlayerEventType.STOP) {
      audioRef.value.pause();
      audioRef.value.currentTime = 0;
      audioRef.value.src = "";
      playing.value = false;
    } else if (data.type === BuiltinPlayerEventType.POWER_ON) {
      // TODO: only switch the audio source once interacted
      // But the user most likely started playback from the same tab
      webPlayer.audioSource = WebPlayerMode.BUILTIN;
    } else if (data.type === BuiltinPlayerEventType.POWER_OFF) {
      webPlayer.audioSource = WebPlayerMode.CONTROLS_ONLY;
    } else if (data.type === BuiltinPlayerEventType.TIMEOUT) {
      // Silently shut down the player in this tab
      webPlayer.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
    }
  },
  props.playerId,
);

onBeforeUnmount(unsub);
// Setup interval for state updates
let stateInterval: any | undefined;

const updatePlayerState = async function () {
  const player_id = props.playerId;
  if (!audioRef.value || !player_id) return;
  if (webPlayer.timedOutDueToThrottling()) {
    // The player timed out due to the browser freezing the timeout!
    webPlayer.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
    return;
  }
  let success;
  if (webPlayer.audioSource === WebPlayerMode.BUILTIN) {
    if (playing.value) {
      success = await api.updateBuiltinPlayerState(player_id, {
        powered: true,
        playing: !audioRef.value.paused,
        paused: audioRef.value.paused && !audioRef.value.ended,
        muted: audioRef.value.muted,
        volume: Math.round(audioRef.value.volume * 100),
        position: audioRef.value.currentTime,
      });
    } else {
      success = await api.updateBuiltinPlayerState(player_id, {
        powered: true,
        playing: false,
        paused: false,
        muted: audioRef.value.muted,
        volume: Math.round(audioRef.value.volume * 100),
        position: 0,
      });
    }
  } else {
    success = await api.updateBuiltinPlayerState(props.playerId, {
      powered: false,
      playing: false,
      paused: false,
      muted: false,
      volume: 0,
      position: 0,
    });
  }
  if (!success) {
    // The player timed out!
    webPlayer.setTabMode(WebPlayerMode.CONTROLS_ONLY, true);
  } else {
    webPlayer.lastUpdate = Date.now();
  }
};

watch(
  () => [playing.value, webPlayer.audioSource],
  async () => {
    // TODO: trigger this on BUILTIN_PLAYER commands
    const player_id = props.playerId;

    if (!player_id) {
      return;
    }
    let interval;
    if (webPlayer.audioSource !== WebPlayerMode.BUILTIN) {
      // Just a keep alive when powered off
      interval = 60000;
    } else if (playing.value) {
      // Use faster interval when playing
      interval = 5000;
    } else {
      interval = 30000;
    }
    if (stateInterval) clearInterval(stateInterval);
    stateInterval = setInterval(async () => {
      await updatePlayerState();
    }, interval) as any;
    await updatePlayerState();
  },
  { immediate: true },
);

let unsubMetadata: (() => void) | undefined;

watch(
  () => webPlayer.audioSource,
  (source) => {
    if (unsubMetadata) unsubMetadata();
    unsubMetadata = undefined;
    if (source === WebPlayerMode.BUILTIN) {
      unsubMetadata = useMediaBrowserMetaData(props.playerId);
    }
  },
);

// Watch for queue updates to preload the next track
// When the next_item changes, start preloading it in the background
watch(
  () => {
    const queue = api.queues[props.playerId];
    return queue?.next_item?.queue_item_id;
  },
  () => {
    if (webPlayer.audioSource === WebPlayerMode.BUILTIN && playing.value) {
      preloadNextTrack(props.playerId);
    }
  },
);

// Clean up interval on component unmount
onBeforeUnmount(() => {
  if (stateInterval) {
    clearInterval(stateInterval);
  }
  if (unsubMetadata) unsubMetadata();
});

// MediaSession setup
onMounted(() => {
  navigator.mediaSession.setActionHandler("play", () => {
    if (!props.playerId) return;
    api.playerCommandPlay(props.playerId);
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    if (!props.playerId) return;
    // directly pause to avoid the round trip delay from the network
    if (audioRef.value) audioRef.value.pause();
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

  if (!audioRef.value) return;

  audioRef.value.addEventListener("playing", () => {
    // Start preloading the next track once current track is playing
    preloadNextTrack(props.playerId);
  });

  audioRef.value.addEventListener("error", () => {
    playing.value = false;
  });

  // Setup event listeners for the preload audio element
  if (nextAudioRef.value) {
    nextAudioRef.value.addEventListener("error", () => {
      // Clear preload state if loading fails
      nextTrackPreloaded.value = false;
      preloadedNextItemId.value = undefined;
    });
  }
});
</script>
<style lang="css">
.builtin-player {
  width: 0;
  height: 0;
}
</style>
