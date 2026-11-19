import { isProviderErrorStatus } from "@/helpers/provider_config";
import {
  type ProviderConfig,
  ProviderStatus,
  type RemoteAccessInfo,
} from "@/plugins/api/interfaces";

export const HASS_DOMAIN = "hass";
export const HASS_PLAYERS_DOMAIN = "hass_players";

export type HassConnectionState =
  "not_set_up" | "connecting" | "connected" | "disabled" | "needs_attention";

/**
 * The state of the connection with Home Assistant.
 *
 * @param config - The config of the Home Assistant provider, if it is set up.
 */
export function hassConnectionState(
  config: ProviderConfig | undefined,
): HassConnectionState {
  if (!config) return "not_set_up";
  if (isProviderErrorStatus(config.status)) return "needs_attention";
  if (config.status === ProviderStatus.DISABLED) return "disabled";
  return config.status === ProviderStatus.LOADED ? "connected" : "connecting";
}

/**
 * The translation key of how remote access runs: off, or on with or without
 * Home Assistant Cloud.
 */
export function remoteAccessStateKey(info: RemoteAccessInfo): string {
  if (!info.enabled) return "off";
  return info.using_ha_cloud
    ? "settings.home_assistant.remote_access_ha_cloud"
    : "settings.home_assistant.remote_access_without_ha_cloud";
}
