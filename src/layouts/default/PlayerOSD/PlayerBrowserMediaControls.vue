<template>
  <audio
    ref="audioRef"
    controls
    :src="audio"
    loop
    class="audio-control"
  ></audio>
</template>

<script setup lang="ts">
// Firefox does not show the notification if the playing audio file is completely silent.
// This audio file therefore has inaudiable sine pulses at 15Hz (made as quiet as possible).
import audio from "@/assets/almost_silent.mp3";
import { useMediaBrowserMetaData } from "@/helpers/useMediaBrowserMetaData";
import api from "@/plugins/api";
import { PlayerState } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { onMounted, ref, watch } from "vue";

const audioRef = ref<HTMLAudioElement>();

function apiCommandWithCurrentPlayer<T extends (id: string) => any>(
  command: T,
) {
  const activePlayer = store.activePlayer;
  if (!activePlayer) return;
  return command(activePlayer?.player_id);
}

function updateMediaState(state?: PlayerState) {
  if (!state || !audioRef.value) return;
  let mediaState: MediaSessionPlaybackState;

  switch (state) {
    case PlayerState.PLAYING:
      audioRef.value.play();
      mediaState = state;
      break;
    case PlayerState.PAUSED:
      audioRef.value.pause();
      mediaState = state;
      break;
    default:
      audioRef.value.pause();
      mediaState = "none";
  }

  navigator.mediaSession.playbackState = mediaState;
}

watch(
  () => store.activePlayer?.state,
  (stateUpdate) => updateMediaState(stateUpdate),
);

// Wait for audioRef to load
watch(
  () => audioRef.value,
  () => updateMediaState(store.activePlayer?.state),
  { once: true },
);

updateMediaState(store.activePlayer?.state);

// This allows for correct seeking on repeated seek forward/backward presses
let lastElapsedTime = undefined as undefined | number;

watch(
  () => store.activePlayerQueue?.elapsed_time,
  (elapsed_time) => {
    lastElapsedTime = elapsed_time;
  },
  { immediate: true },
);

useMediaBrowserMetaData();

const seekHandler = function (
  evt: MediaSessionActionDetails,
  player_id: string,
  is_backward = false,
) {
  let to = null;
  if (evt.seekTime) {
    to = evt.seekTime;
  } else if (evt.seekOffset) {
    const elapsed_time = lastElapsedTime;
    if (!elapsed_time) return;
    if (is_backward) {
      to = elapsed_time - evt.seekOffset;
    } else {
      to = elapsed_time + evt.seekOffset;
    }
  } else {
    return;
  }
  to = Math.round(to);
  lastElapsedTime = to;
  api.playerCommandSeek(player_id, to);
};

// MediaSession setup
onMounted(() => {
  navigator.mediaSession.setActionHandler("play", () => {
    apiCommandWithCurrentPlayer(api.playerCommandPlay.bind(api));
  });
  navigator.mediaSession.setActionHandler("pause", () => {
    // workaround-alert: delay the pause command a tiny bit
    // to workaround a browser bug where pause is sent if a laptop/computer
    // goes to standby (lid closed). This issue seems to only exist on Chromium based browsers.
    setTimeout(() => {
      apiCommandWithCurrentPlayer(api.playerCommandPause.bind(api));
    }, 250);
  });
  navigator.mediaSession.setActionHandler("nexttrack", () => {
    apiCommandWithCurrentPlayer(api.playerCommandNext.bind(api));
  });
  navigator.mediaSession.setActionHandler("previoustrack", () => {
    apiCommandWithCurrentPlayer(api.playerCommandPrevious.bind(api));
  });
  navigator.mediaSession.setActionHandler("seekto", (evt) => {
    apiCommandWithCurrentPlayer((id) => seekHandler(evt, id));
  });
  navigator.mediaSession.setActionHandler("seekforward", (evt) => {
    apiCommandWithCurrentPlayer((id) => seekHandler(evt, id));
  });
  navigator.mediaSession.setActionHandler("seekbackward", (evt) => {
    apiCommandWithCurrentPlayer((id) => seekHandler(evt, id, true));
  });
});
</script>
<style lang="css">
.audio-control {
  width: 0;
  height: 0;
}
</style>
