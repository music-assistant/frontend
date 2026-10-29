import { getPlayerName } from "@/helpers/player_config";
import {
  isBuiltinPlayer,
  isPlayerManagedExternally,
  isPlayerUnavailable,
} from "@/helpers/players";
import { api } from "@/plugins/api";
import type { PlayerConfig } from "@/plugins/api/interfaces";
import { computed, type Ref } from "vue";

/** What the players settings list and cards show for one player config. */
export function useSettingsPlayer(playerConfig: Ref<PlayerConfig>) {
  const player = computed(() => api.players[playerConfig.value.player_id]);
  const playerName = computed(() => getPlayerName(playerConfig.value));
  const isUnavailable = computed(() => isPlayerUnavailable(player.value));
  // nothing about it can be changed here: no settings page and no menu
  const isManagedExternally = computed(() =>
    isPlayerManagedExternally(player.value),
  );
  const isThisDevice = computed(
    () => player.value !== undefined && isBuiltinPlayer(player.value),
  );
  const needsSetup = computed(
    () => playerConfig.value.enabled && (player.value?.needs_setup ?? false),
  );
  const providerName = computed(() => {
    const deviceInfo = player.value?.device_info;
    if (deviceInfo) return `${deviceInfo.manufacturer} / ${deviceInfo.model}`;
    return (
      api.getProviderManifest(playerConfig.value.provider)?.name ||
      playerConfig.value.provider
    );
  });
  // all output methods for this player, native included
  const outputProtocols = computed(() => player.value?.output_protocols || []);

  return {
    player,
    playerName,
    isUnavailable,
    isManagedExternally,
    isThisDevice,
    needsSetup,
    providerName,
    outputProtocols,
  };
}
