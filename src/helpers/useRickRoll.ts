import {
  RICKROLL_ART_URL,
  RICKROLL_AUDIO_URL,
  RICKROLL_START_OFFSET,
  RICKROLL_TRACK as TRACK,
  isRickrollUri,
} from "@/helpers/rickroll";
import api from "@/plugins/api";
import {
  MediaType,
  PlaybackState,
  QueueOption,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { useEventListener } from "@vueuse/core";
import { onMounted, onUnmounted, watch } from "vue";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export function useRickRoll() {
  function start() {
    if (!store.activePlayer) return;
    api.playMedia(RICKROLL_AUDIO_URL, QueueOption.PLAY).catch(() => {});
  }

  // Konami code detector.
  let konamiIndex = 0;
  useEventListener(window, "keydown", (event: KeyboardEvent) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === KONAMI[konamiIndex]) {
      konamiIndex += 1;
      if (konamiIndex === KONAMI.length) {
        konamiIndex = 0;
        start();
      }
    } else {
      konamiIndex = key === KONAMI[0] ? 1 : 0;
    }
  });

  let rickrollSeeked = false;
  watch(
    () =>
      [
        store.activePlayer?.current_media,
        store.activePlayer?.playback_state,
      ] as const,
    ([media, state]) => {
      if (!media || !isRickrollUri(media.uri)) {
        rickrollSeeked = false;
        return;
      }
      if (media.title !== TRACK.title) {
        media.title = TRACK.title;
        media.artist = TRACK.artist;
        media.album = TRACK.album;
        media.image_url = RICKROLL_ART_URL;
        media.media_type = MediaType.TRACK;
      }
      if (!rickrollSeeked && state === PlaybackState.PLAYING) {
        rickrollSeeked = true;
        const queueId = store.activePlayerQueue?.queue_id;
        if (queueId) api.queueCommandSeek(queueId, RICKROLL_START_OFFSET);
      }
    },
    { deep: true, immediate: true },
  );

  onMounted(() => eventbus.on("rickroll", start));
  onUnmounted(() => eventbus.off("rickroll", start));
}
