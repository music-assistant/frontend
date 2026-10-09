import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";

/**
 * Whether the signed-in user gets the AI DJ of a queue: picking its host takes
 * the host list, which only a role that reads the plugin settings may load.
 */
export const canUseQueueDj = (): boolean =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_READ);
