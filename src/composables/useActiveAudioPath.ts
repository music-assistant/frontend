import { computed } from "vue";
import { resolveExternalSource } from "@/composables/externalSource";
import { sourceProviderId } from "@/composables/nowPlayingSource";
import { store } from "@/plugins/store";
import {
  AudioNormalizationMeasurementSource,
  type AudioProcessingChain,
  CrossfadeMode,
  MediaType,
  type StreamDetails,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";

export interface ActiveAudioPath {
  streamDetails: StreamDetails;
  audioProcessing: AudioProcessingChain;
  // only meaningful for the queue path; the source path reports its own
  // crossfade behaviour through CrossfadeMode.SOURCE instead
  crossfadeIntent?: CrossfadeMode;
  // whether this came from the active queue item or a live external source
  kind: "queue" | "source";
}

/**
 * The audio-path details for whatever is currently playing on the active
 * player: the active queue item's stream, or — once nothing plays through a
 * queue (e.g. Spotify Connect) — the player's own external-source snapshot,
 * adapted into the same shape so callers never need to know which it is.
 *
 * This is the single source of truth for both the quality pill's visibility
 * and its popover content, so they never disagree.
 */
export function useActiveAudioPath() {
  const queueStreamDetails = computed(
    () => store.curQueueItem?.streamdetails ?? undefined,
  );
  const queueAudioProcessing = computed(
    () => queueStreamDetails.value?.audio_processing ?? undefined,
  );
  const queueCrossfadeIntent = computed<CrossfadeMode>(() => {
    const queue = store.activePlayerQueue;
    if (!queue?.crossfade_enabled) return CrossfadeMode.DISABLED;
    return queue.smart_fades_active
      ? CrossfadeMode.SMART_CROSSFADE
      : CrossfadeMode.STANDARD_CROSSFADE;
  });

  // a live external source only counts once no queue item is playing through it
  const sourceAudio = computed(() => {
    if (queueAudioProcessing.value) return undefined;
    return store.activePlayer?.active_source_audio ?? undefined;
  });
  const sourceProviderDomain = computed(() => {
    const source = resolveExternalSource(
      store.activePlayer,
      store.activePlayerQueue,
    );
    return source ? sourceProviderId(source.id) : undefined;
  });

  const activeAudioPath = computed<ActiveAudioPath | undefined>(() => {
    if (queueAudioProcessing.value && queueStreamDetails.value) {
      return {
        kind: "queue",
        streamDetails: queueStreamDetails.value,
        audioProcessing: queueAudioProcessing.value,
        crossfadeIntent: queueCrossfadeIntent.value,
      };
    }
    const source = sourceAudio.value;
    if (!source) return undefined;
    return {
      kind: "source",
      streamDetails: {
        provider: sourceProviderDomain.value ?? "",
        item_id: "",
        audio_format: source.input_format,
        media_type: MediaType.UNKNOWN,
        stream_metadata: null,
        duration: null,
        audio_processing: null,
      },
      audioProcessing: {
        input_fidelity: source.input_fidelity,
        queue_processing: {
          pcm_format: null,
          normalization:
            source.volume_normalization_mode === VolumeNormalizationMode.SOURCE
              ? {
                  mode: VolumeNormalizationMode.SOURCE,
                  measurement_source:
                    AudioNormalizationMeasurementSource.UNKNOWN,
                  target_lufs: null,
                  measured_lufs: null,
                  applied_gain_db: null,
                }
              : null,
          playback_speed: 1,
          crossfade_mode:
            source.crossfade_mode === CrossfadeMode.SOURCE
              ? CrossfadeMode.SOURCE
              : CrossfadeMode.DISABLED,
          overlay_active: false,
        },
        outputs: source.outputs,
      },
    };
  });

  const hasActiveAudioPath = computed(
    () => activeAudioPath.value !== undefined,
  );

  return { activeAudioPath, hasActiveAudioPath };
}
