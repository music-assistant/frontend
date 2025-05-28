<template>
  <audio ref="audioRef" controls class="builtin-player"></audio>
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

let playing = ref<boolean>();

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
      audioRef.value.src = "";
      audioRef.value.src = `${webPlayer.baseUrl}/${data.media_url}`;
      await audioRef.value.play();
      playing.value = true;
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
  audioRef.value.addEventListener("error", () => {
    // So it shows up as paused, proper recovery is something for a custom protocol
    playing.value = false;
  });
});
</script>
<style lang="css">
.builtin-player {
  width: 0;
  height: 0;
}
</style>
