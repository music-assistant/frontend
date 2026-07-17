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
let loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

const { getPreference } = useUserPreferences();
const showWaveformPref = getPreference("show_waveform", true);

// Watch queue/stream IDs and the show_waveform preference together so that
// toggling the preference re-triggers a fetch without a track change.
watch(
  () =>
    [
      store.curQueueItem?.queue_item_id,
      store.curQueueItem?.streamdetails?.item_id,
      showWaveformPref.value,
    ] as const,
  async ([queueItemId, streamItemId, showWaveform]) => {
    const fetchKey = `${showWaveform}:${queueItemId}:${streamItemId}`;
    if (fetchKey === lastFetchKey) return;
    lastFetchKey = fetchKey;

    if (loadingTimeoutId !== null) {
      clearTimeout(loadingTimeoutId);
      loadingTimeoutId = null;
    }

    waveformBins.value = null;
    waveformLoading.value = false;
    trackDurationSecs.value = store.curQueueItem?.duration ?? 0;

    const mediaItem = store.curQueueItem?.media_item;
    if (!mediaItem || mediaItem.media_type !== MediaType.TRACK) return;
    if (!showWaveform) return;

    const streamDetails = store.curQueueItem?.streamdetails;
    if (!streamDetails) {
      waveformLoading.value = true;
      // Safety net: clear loading if streamdetails never arrive for this item.
      loadingTimeoutId = setTimeout(() => {
        if (lastFetchKey === fetchKey) waveformLoading.value = false;
      }, 5000);
      return;
    }

    waveformLoading.value = true;
    try {
      const bins = await api.getWaveForm(
        streamDetails.item_id,
        streamDetails.provider,
      );
      const currentKey = `${showWaveformPref.value}:${store.curQueueItem?.queue_item_id}:${store.curQueueItem?.streamdetails?.item_id}`;
      if (currentKey !== fetchKey) return;
      waveformBins.value = bins?.length ? bins : null;
    } catch {
      // No audio analysis available.
    } finally {
      const currentKey = `${showWaveformPref.value}:${store.curQueueItem?.queue_item_id}:${store.curQueueItem?.streamdetails?.item_id}`;
      if (currentKey === fetchKey) waveformLoading.value = false;
    }
  },
  { immediate: true },
);

export function useActiveTrackWaveform() {
  return { waveformBins, trackDurationSecs, waveformLoading };
}
