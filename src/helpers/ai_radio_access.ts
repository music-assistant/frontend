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
