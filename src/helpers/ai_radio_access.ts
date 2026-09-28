import { api } from "@/plugins/api";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";

/**
 * Whether the signed-in user may open AI Radio: a role that configures it
 * always may, any other role only on a server that lets it play the stations.
 */
export const canOpenAIRadio = (): boolean =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE) ||
  api.supportsAIRadioPlaybackScopes;

/**
 * Whether the signed-in user gets the AI DJ of a queue: picking its host takes
 * the host list, which only a role that reads the plugin settings may load.
 */
export const canUseQueueDj = (): boolean =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_READ);
