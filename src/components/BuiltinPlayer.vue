<template>
  <audio ref="audioRef" controls class="bultin-player"></audio>
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
  // TODO: reload if changed
  playerId: string;
}
const props = defineProps<Props>();

const audioRef = ref<HTMLAudioElement>();

let playing = ref<boolean>();

const unsub = api.subscribe(
  EventType.BUILTIN_PLAYER,
  (evt: EventMessage) => {
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
      audioRef.value.play();
      playing.value = true;
    } else if (data.type === BuiltinPlayerEventType.SET_VOLUME) {
      audioRef.value.volume = data.volume! / 100;
    } else if (data.type === BuiltinPlayerEventType.PLAY_MEDIA) {
      audioRef.value.src = "";
      audioRef.value.src = `${webPlayer.baseUrl}/${data.media_url}`;
      if (audioRef.value.paused) audioRef.value.play();
      playing.value = true;
    } else if (data.type === BuiltinPlayerEventType.STOP) {
      audioRef.value.pause();
      audioRef.value.currentTime = 0;
      audioRef.value.src = "";
      playing.value = false;
    } else if (data.type === BuiltinPlayerEventType.POWER_ON) {
      // TODO: only switch the audio source once interacted
      webPlayer.audioSource = WebPlayerMode.BUILTIN;
    } else if (data.type === BuiltinPlayerEventType.POWER_OFF) {
      webPlayer.audioSource = WebPlayerMode.CONTROLS_ONLY;
    } else if (data.type === BuiltinPlayerEventType.TIMEOUT) {
      // TODO: timeout should probably completely shutdown the player until a full page reload
      webPlayer.audioSource = WebPlayerMode.CONTROLS_ONLY;
    }
  },
  props.playerId,
);

onBeforeUnmount(unsub);
// Setup interval for state updates
let stateInterval: any | undefined;

const updatePlayerState = function () {
  const player_id = props.playerId;
  if (!audioRef.value || !player_id) return;
  if (webPlayer.audioSource === WebPlayerMode.BUILTIN) {
    if (playing.value) {
      api.updateBuiltinPlayerState(player_id, {
        powered: true,
        playing: !audioRef.value.paused,
        paused: audioRef.value.paused && !audioRef.value.ended,
        muted: audioRef.value.muted,
        volume: Math.round(audioRef.value.volume * 100),
        position: audioRef.value.currentTime,
      });
    } else {
      api.updateBuiltinPlayerState(player_id, {
        powered: true,
        playing: false,
        paused: false,
        muted: audioRef.value.muted,
        volume: Math.round(audioRef.value.volume * 100),
        position: 0,
      });
    }
  } else {
    api.updateBuiltinPlayerState(props.playerId, {
      powered: false,
      playing: false,
      paused: false,
      muted: false,
      volume: 0,
      position: 0,
    });
  }
};

watch(
  [() => playing, () => webPlayer.audioSource],
  () => {
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
    stateInterval = setInterval(() => {
      updatePlayerState();
    }, interval) as any;
    updatePlayerState();
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
  // TODO: directly pause to avoid the delay from the network
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
});
</script>
<style lang="css">
.builtin-player {
  width: 0;
  height: 0;
}
</style>
