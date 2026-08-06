import {
  effectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  watch,
  type WatchStopHandle,
} from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { MediaType } from "@/plugins/api/interfaces";
import { useUserPreferences } from "@/composables/userPreferences";

// Module-level shared state: waveform bins and track duration for the
// currently playing track. Any component can read this without triggering
// duplicate API calls.
const waveformBins = ref<number[] | null>(null);
const trackDurationSecs = ref<number>(0);

const { getPreference } = useUserPreferences();
const showWaveformPref = getPreference("show_waveform", true);

// Survives a watcher restart so that a consumer remounting on an unchanged
// track keeps the cached bins instead of refetching them.
let lastFetchKey: string | undefined;

let consumerCount = 0;
let stopWatcher: WatchStopHandle | undefined;

// Detached scope, so the watcher does not get collected by the effect scope of
// whichever consumer happened to register first.
const watcherScope = effectScope(true);

/**
 * Waveform bins and duration of the currently playing track.
 *
 * The data is shared between all callers and fetched once per track. Fetching
 * only runs while at least one caller is alive.
 */
export function useActiveTrackWaveform() {
  if (++consumerCount === 1) startWatcher();

  // A caller outside an effect scope cannot signal teardown, so it keeps the
  // watcher alive for the lifetime of the module.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (--consumerCount === 0) {
        stopWatcher?.();
        stopWatcher = undefined;
      }
    });
  }

  return { waveformBins, trackDurationSecs };
}

// Watch queue/stream IDs and the show_waveform preference together so that
// toggling the preference re-triggers a fetch without a track change.
function startWatcher() {
  stopWatcher = watcherScope.run(() =>
    watch(
      () =>
        [
          store.curQueueItem?.queue_item_id,
          store.curQueueItem?.streamdetails?.item_id,
          showWaveformPref.value,
        ] as const,
      loadWaveform,
      { immediate: true },
    ),
  );
}

async function loadWaveform([
  queueItemId,
  streamItemId,
  showWaveform,
]: readonly [string | undefined, string | undefined, boolean]) {
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
}
