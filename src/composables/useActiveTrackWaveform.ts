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

let lastFetchKey: string | undefined;

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

    waveformBins.value = null;
    trackDurationSecs.value = store.curQueueItem?.duration ?? 0;

    const mediaItem = store.curQueueItem?.media_item;
    if (!mediaItem || mediaItem.media_type !== MediaType.TRACK) return;
    if (!showWaveform) return;

    // Without streamdetails there is nothing to analyse yet; this refires once
    // they arrive, because the watcher tracks their item id.
    const streamDetails = store.curQueueItem?.streamdetails;
    if (!streamDetails) return;

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
    }
  },
  { immediate: true },
);

export function useActiveTrackWaveform() {
  return { waveformBins, trackDurationSecs };
}
