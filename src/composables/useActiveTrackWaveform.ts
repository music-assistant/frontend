import {
  computed,
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
import { expertModeSetting } from "@/helpers/expert_mode";

// Module-level shared state: waveform bins and track duration for the
// currently playing track. Any component can read this without triggering
// duplicate API calls.
const waveformBins = ref<number[] | null>(null);
const trackDurationSecs = ref<number>(0);

const showWaveformPref = computed(() => expertModeSetting("show_waveform"));

// Consumers that asked for the waveform regardless of the setting; while one
// of them is alive the bins are fetched anyway.
const forcedConsumerCount = ref(0);
const wanted = computed(
  () => forcedConsumerCount.value > 0 || showWaveformPref.value,
);

// Survives a watcher restart so that a consumer remounting on an unchanged
// track keeps the cached bins instead of refetching them.
let lastFetchKey: string | undefined;

let consumerCount = 0;
let stopWatcher: WatchStopHandle | undefined;

// Detached scope, so the shared watcher is not torn down together with the
// effect scope of whichever consumer happened to register first.
const watcherScope = effectScope(true);

/**
 * Waveform bins and duration of the currently playing track.
 *
 * The data is shared between all callers and fetched once per track. Fetching
 * only runs while at least one caller is alive. A caller sees the bins only
 * while the user's waveform setting is on, unless it passes `ignorePreference`
 * to get them regardless; a fetch made for such a caller stays hidden from the
 * ones that follow the setting.
 */
export function useActiveTrackWaveform(options?: {
  ignorePreference?: boolean;
}) {
  const ignorePreference = options?.ignorePreference === true;
  if (ignorePreference) forcedConsumerCount.value++;
  if (++consumerCount === 1) startWatcher();

  // A caller outside an effect scope cannot signal teardown, so it keeps the
  // watcher alive for the lifetime of the module.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (ignorePreference) forcedConsumerCount.value--;
      if (--consumerCount === 0) {
        stopWatcher?.();
        stopWatcher = undefined;
      }
    });
  }

  // the shared bins, unless they were only fetched for a caller that ignores
  // the setting while this one follows it
  const visibleBins = computed(() =>
    ignorePreference || showWaveformPref.value ? waveformBins.value : null,
  );

  return { waveformBins: visibleBins, trackDurationSecs };
}

function startWatcher() {
  stopWatcher = watcherScope.run(() =>
    watch(currentFetchKey, loadWaveform, { immediate: true }),
  );
}

/**
 * Identifies everything the waveform request depends on, so that a change in
 * any of it triggers a fetch and cached bins are never reused across it.
 */
function currentFetchKey() {
  const streamDetails = store.curQueueItem?.streamdetails;
  return [
    wanted.value,
    store.curQueueItem?.queue_item_id,
    streamDetails?.item_id,
    streamDetails?.provider,
  ].join(":");
}

async function loadWaveform(fetchKey: string) {
  if (fetchKey === lastFetchKey) return;
  lastFetchKey = fetchKey;

  waveformBins.value = null;
  trackDurationSecs.value = store.curQueueItem?.duration ?? 0;

  const mediaItem = store.curQueueItem?.media_item;
  if (!mediaItem || mediaItem.media_type !== MediaType.TRACK) return;
  if (!wanted.value) return;

  // Without streamdetails there is nothing to analyse yet; this refires once
  // they arrive, because the key covers them.
  const streamDetails = store.curQueueItem?.streamdetails;
  if (!streamDetails) return;

  try {
    const bins = await api.getWaveForm(
      streamDetails.item_id,
      streamDetails.provider,
    );
    // Drop the result unless it still matches both what is playing and what the
    // cache claims to hold; while the watcher is stopped the two can drift, and
    // storing bins the cache key does not describe would serve them for the
    // wrong track on the next mount.
    if (currentFetchKey() !== fetchKey || lastFetchKey !== fetchKey) return;
    waveformBins.value = bins?.length ? bins : null;
  } catch {
    // No audio analysis available.
  }
}
