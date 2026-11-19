import { isProviderErrorStatus } from "@/helpers/provider_config";
import { type ProviderConfig, ProviderStatus } from "@/plugins/api/interfaces";

export const HASS_DOMAIN = "hass";
export const HASS_PLAYERS_DOMAIN = "hass_players";
// the webserver setting that gives a Home Assistant user without an account
// one when they first sign in with Home Assistant
export const SELF_REGISTRATION_KEY = "auth_allow_self_registration";

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
 * The translation key of how remote access that is on runs: with or without
 * Home Assistant Link.
 *
 * @param usingHaCloud - Whether remote access runs through Home Assistant Link.
 */
export function remoteAccessStateKey(usingHaCloud: boolean): string {
  return usingHaCloud
    ? "settings.home_assistant.remote_access_ha_cloud"
    : "settings.home_assistant.remote_access_without_ha_cloud";
}
