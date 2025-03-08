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
import { webPlayer } from "@/plugins/web_player";
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
    } else if (data.type === BuiltinPlayerEventType.TIMEOUT) {
      webPlayer.disable();
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
  if (playing.value) {
    api.updateBuiltinPlayerState(player_id, {
      playing: !audioRef.value.paused,
      paused: audioRef.value.paused && !audioRef.value.ended,
      muted: audioRef.value.muted,
      volume: Math.round(audioRef.value.volume * 100),
      position: audioRef.value.currentTime,
    });
  } else {
    api.updateBuiltinPlayerState(player_id, {
      playing: false,
      paused: false,
      muted: audioRef.value.muted,
      volume: Math.round(audioRef.value.volume * 100),
      position: 0,
    });
  }
};

watch(playing, () => {
  const player_id = props.playerId;

  if (!player_id) {
    return;
  }
  if (playing.value) {
    if (stateInterval) clearInterval(stateInterval);
    // Start fast interval when playing
    stateInterval = setInterval(() => {
      updatePlayerState();
    }, 5000) as any;
    updatePlayerState();
  } else {
    if (stateInterval) clearInterval(stateInterval);
    // Use slower interval when paused
    stateInterval = setInterval(() => {
      updatePlayerState();
    }, 30000) as any;
    updatePlayerState();
  }
});

useMediaBrowserMetaData(props.playerId);

// Clean up interval on component unmount
onBeforeUnmount(() => {
  if (stateInterval) {
    clearInterval(stateInterval);
  }
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
