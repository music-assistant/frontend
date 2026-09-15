import { computed, ComputedRef, Ref } from "vue";
import api from "@/plugins/api";
import {
  MediaType,
  PlaybackState,
  Player,
  PlayerQueue,
} from "@/plugins/api/interfaces";
import { useActiveAudioSource } from "@/composables/activeAudioSource";
import { useActiveSource } from "@/composables/activeSource";

type PlayerRef = ComputedRef<Player | undefined> | Ref<Player | undefined>;
type PlayerQueueRef =
  | ComputedRef<PlayerQueue | undefined>
  | Ref<PlayerQueue | undefined>;

// Shared by the play button and the spacebar shortcut so they always agree.
export function usePlayPauseCommand(
  player: PlayerRef,
  playerQueue: PlayerQueueRef,
) {
  const { activeSource } = useActiveSource(player);
  const { activeAudioSource } = useActiveAudioSource(player);

  const queueCanPlay = computed(() => {
    if (!playerQueue.value) return false;
    return playerQueue.value.items > 0;
  });

  const playerCanPlay = computed(() => {
    if (!player.value) return false;
    if (playerQueue.value?.active) return false;
    if (!player.value.current_media) return false;
    return true;
  });

  const canPlayPause = computed(() => {
    // AudioSource queue items carry their own capability flags
    if (activeAudioSource.value) {
      return activeAudioSource.value.can_play_pause;
    }
    // Check if active source can play/pause
    if (activeSource.value) {
      return activeSource.value.can_play_pause;
    }
    // Fall back to queue or player capabilities
    return queueCanPlay.value || playerCanPlay.value;
  });

  // When the current media can't be paused, Stop is the only way to end
  // playback: AudioSources without pause support, external sources that
  // don't advertise it, and radio streams.
  const showStop = computed(() => {
    if (activeAudioSource.value) return !activeAudioSource.value.can_play_pause;
    if (player.value?.current_media?.media_type === MediaType.RADIO)
      return true;
    if (activeSource.value) return !activeSource.value.can_play_pause;
    return false;
  });

  const isPlaying = computed(() => {
    return player.value?.playback_state == PlaybackState.PLAYING;
  });

  const isLoading = computed(() => {
    if (!player.value) return false;
    return (
      playerQueue.value?.extra_attributes?.play_action_in_progress === true
    );
  });

  const isDisabled = computed(() => {
    // nothing to address the command to
    if (!player.value) return true;
    // an earlier play action is still in flight
    if (isLoading.value) return true;
    // Stop is always available while playing, even when pause isn't supported
    if (isPlaying.value && showStop.value) return false;
    return !canPlayPause.value;
  });

  const playPause = () => {
    if (!player.value) return;
    if (isPlaying.value && showStop.value) {
      api.playerCommandStop(player.value.player_id);
    } else {
      api.playerCommandPlayPause(player.value.player_id);
    }
  };

  return { isPlaying, showStop, isLoading, isDisabled, playPause };
}
