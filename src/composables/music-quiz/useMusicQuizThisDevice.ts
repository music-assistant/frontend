import type { MusicQuizPlaybackOptions } from "@/composables/music-quiz/useMusicQuiz";
import { saveDeviceSetting } from "@/helpers/device_settings";
import { isBuiltinPlayer } from "@/helpers/players";
import api from "@/plugins/api";
import { companionMode } from "@/plugins/companion";
import {
  isPlaybackMode,
  WEB_PLAYER_ENABLED,
  webPlayer,
} from "@/plugins/web_player";
import { computed, onBeforeUnmount, ref, watch } from "vue";

// how long to wait for this browser's web player to join the venue players
const WEB_PLAYER_CONNECT_TIMEOUT_MS = 20_000;

export interface UseMusicQuizThisDeviceOptions {
  /** Fetch the playback options again. */
  refresh: () => void;
  /** Select the given player as the venue player. */
  select: (playerId: string) => void;
}

/**
 * Find the venue player of the device showing the quiz, and let the host turn
 * on this browser's web player to play the quiz here.
 */
export function useMusicQuizThisDevice(
  playbackOptions: () => MusicQuizPlaybackOptions | null,
  { refresh, select }: UseMusicQuizThisDeviceOptions,
) {
  const connecting = ref(false);
  let stopConnecting: (() => void) | null = null;

  const thisDevicePlayerId = computed(
    () =>
      playbackOptions()?.venue_players.find((player) => {
        const apiPlayer = api.players[player.player_id];
        return apiPlayer !== undefined && isBuiltinPlayer(apiPlayer);
      })?.player_id ?? null,
  );
  // the companion app plays through its own player, which it manages itself
  const canPlayOnThisDevice = computed(
    () =>
      connecting.value ||
      (!thisDevicePlayerId.value &&
        !companionMode.value &&
        !isPlaybackMode(webPlayer.mode)),
  );

  /**
   * Turn on this browser's web player and select it once it is a venue player.
   */
  function playOnThisDevice() {
    if (connecting.value) return;
    connecting.value = true;
    saveDeviceSetting(WEB_PLAYER_ENABLED, "true");

    // the server only sends the venue players on request
    const stopRefresh = watch(
      () =>
        !!webPlayer.player_id && !!api.players[webPlayer.player_id]?.available,
      (online) => {
        if (online) refresh();
      },
    );
    const stopSelect = watch(thisDevicePlayerId, (playerId) => {
      if (!playerId) return;
      select(playerId);
      finishConnecting();
    });
    const timeout = window.setTimeout(
      finishConnecting,
      WEB_PLAYER_CONNECT_TIMEOUT_MS,
    );
    stopConnecting = () => {
      stopRefresh();
      stopSelect();
      window.clearTimeout(timeout);
    };
  }

  function finishConnecting() {
    stopConnecting?.();
    stopConnecting = null;
    connecting.value = false;
  }

  onBeforeUnmount(finishConnecting);

  return {
    thisDevicePlayerId,
    canPlayOnThisDevice,
    connecting,
    playOnThisDevice,
    // lets a player the host picks while waiting win over this device
    cancelPlayOnThisDevice: finishConnecting,
  };
}
