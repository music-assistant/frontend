import { ref, watch } from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { MediaType } from "@/plugins/api/interfaces";
import { useUserPreferences } from "@/composables/userPreferences";

// Module-level shared state: waveform bins and track duration for the
// currently playing track. Any component can read this without triggering
// duplicate API calls.
const waveformBins = ref<number[] | null>(null);
const trackDurationSecs = ref<number>(0);
const waveformLoading = ref(false);

let lastFetchKey: string | undefined;

const { getPreference } = useUserPreferences();
const showWaveformPref = getPreference("show_waveform", true);

// Watch both queue_item_id and streamdetails.item_id because streamdetails
// arrive asynchronously after the queue item switches.
watch(
  () => [
    store.curQueueItem?.queue_item_id,
    store.curQueueItem?.streamdetails?.item_id,
  ] as const,
  async ([queueItemId, streamItemId]) => {
    const fetchKey = `${queueItemId}:${streamItemId}`;
    if (fetchKey === lastFetchKey) return;
    lastFetchKey = fetchKey;

    waveformBins.value = null;
    trackDurationSecs.value = store.curQueueItem?.duration ?? 0;

    const mediaItem = store.curQueueItem?.media_item;
    if (!mediaItem || mediaItem.media_type !== MediaType.TRACK) return;
    if (!showWaveformPref.value) return;

    const streamDetails = store.curQueueItem?.streamdetails;
    if (!streamDetails) {
      waveformLoading.value = true;
      return;
    }

    waveformLoading.value = true;
    try {
      const bins = await api.getWaveForm(
        streamDetails.item_id,
        streamDetails.provider,
      );
      const currentKey = `${store.curQueueItem?.queue_item_id}:${store.curQueueItem?.streamdetails?.item_id}`;
      if (currentKey !== fetchKey) return;
      waveformBins.value = bins?.length ? bins : null;
    } catch {
      // No audio analysis available.
    } finally {
      const currentKey = `${store.curQueueItem?.queue_item_id}:${store.curQueueItem?.streamdetails?.item_id}`;
      if (currentKey === fetchKey) waveformLoading.value = false;
    }
  },
  { immediate: true },
);

// React to show_waveform preference changes.
watch(showWaveformPref, (show) => {
  if (!show) {
    waveformBins.value = null;
    waveformLoading.value = false;
  }
});

export function useActiveTrackWaveform() {
  return { waveformBins, trackDurationSecs, waveformLoading };
}
