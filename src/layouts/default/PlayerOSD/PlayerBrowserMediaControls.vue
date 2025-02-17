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
import audio from "@/assets/5_mins_of_silence.mp3";
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
    const elapsed_time = store.activePlayerQueue?.elapsed_time;
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
