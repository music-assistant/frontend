import { computed, toValue, watch, type MaybeRefOrGetter } from "vue";
import api, { ConnectionState } from "@/plugins/api";
import {
  getAudioProcessingSnapshotGeneration,
  getMatchingAudioProcessingSnapshot,
  replaceAudioProcessingSnapshot,
  supportsAudioProcessing,
} from "@/plugins/api/audioProcessing";
import type {
  AudioProcessingChain,
  PlayerQueue,
  StreamDetails,
} from "@/plugins/api/interfaces";

export interface AudioProcessingSource {
  audioProcessingChain?: AudioProcessingChain;
  streamDetails?: StreamDetails;
}

export function selectAudioProcessingSource(
  isSupported: boolean,
  audioProcessingChain: AudioProcessingChain | undefined,
  streamDetails: StreamDetails | undefined,
): AudioProcessingSource {
  if (isSupported) return { audioProcessingChain };
  return { streamDetails };
}

export function useAudioProcessingChain(
  queue: MaybeRefOrGetter<PlayerQueue | undefined>,
) {
  const isSupported = computed(() =>
    supportsAudioProcessing(api.serverInfo.value?.schema_version),
  );
  const canFetch = computed(
    () =>
      api.state.value === ConnectionState.AUTHENTICATED ||
      api.state.value === ConnectionState.INITIALIZED,
  );
  const queueId = computed(() => toValue(queue)?.queue_id);
  const queueItemId = computed(
    () => toValue(queue)?.current_item?.queue_item_id,
  );
  const queueActive = computed(() => toValue(queue)?.active === true);
  const chain = computed(() => {
    if (!isSupported.value || !queueActive.value) return undefined;
    return getMatchingAudioProcessingSnapshot(
      api.audioProcessingChains,
      queueId.value,
      queueItemId.value,
    );
  });

  watch(
    [isSupported, canFetch, queueId, queueItemId, queueActive],
    async (
      [supported, connected, activeQueueId, activeQueueItemId, active],
      _,
      onCleanup,
    ) => {
      if (
        !supported ||
        !connected ||
        !activeQueueId ||
        !activeQueueItemId ||
        !active
      ) {
        return;
      }

      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      const generationBeforeFetch = getAudioProcessingSnapshotGeneration(
        api.audioProcessingChains,
        activeQueueId,
      );

      try {
        const snapshot = await api.getAudioProcessingChain(activeQueueId);
        if (
          cancelled ||
          !queueActive.value ||
          queueId.value !== activeQueueId ||
          queueItemId.value !== activeQueueItemId
        ) {
          return;
        }

        if (
          getAudioProcessingSnapshotGeneration(
            api.audioProcessingChains,
            activeQueueId,
          ) !== generationBeforeFetch
        ) {
          return;
        }
        replaceAudioProcessingSnapshot(
          api.audioProcessingChains,
          activeQueueId,
          snapshot,
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            `[Audio processing] Failed to load queue ${activeQueueId}:`,
            error,
          );
        }
      }
    },
    { flush: "sync", immediate: true },
  );

  return { chain, isSupported };
}
