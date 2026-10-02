// What the viewer may do with a provider instance. The sources list, its menu and
// the settings page of a source all decide from here, so they never disagree.
import {
  hasConfigurableAccess,
  isOwnMusicSource,
  isSelfServiceProvider,
} from "@/helpers/provider_access";
import { canReconfigureProvider } from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import { type ProviderConfig, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";

/** Whether the viewer manages every provider instance, not only its own music sources. */
export const managesAllSources = () =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE);

/**
 * Whether the viewer may own (and so add) music sources; a role without it
 * only reads the sources it may use.
 */
export const canOwnSources = () =>
  managesAllSources() || authManager.hasScope(Scope.CONFIG_PROVIDERS_OWN);

/**
 * Whether the viewer manages the provider instance: an admin every one, a
 * member the music sources it owns while its role may own sources.
 */
export const canManageSource = (config: ProviderConfig) =>
  managesAllSources() ||
  (canOwnSources() && isOwnMusicSource(config, store.currentUser?.user_id));

/** Whether the viewer may enable and disable the provider instance: whoever manages it. */
export const canToggleSource = (config: ProviderConfig) =>
  canManageSource(config);

/**
 * Whether the viewer may set the provider instance up again, which a member may
 * only do for a source it manages of a provider it may set up itself.
 */
export const maySetUpSource = (config: ProviderConfig) =>
  canManageSource(config) &&
  (managesAllSources() ||
    isSelfServiceProvider(api.providerManifests[config.domain]));

/** Whether the viewer may reconfigure the provider instance in its current state. */
export const canReconfigureSource = (config: ProviderConfig) =>
  maySetUpSource(config) &&
  canReconfigureProvider(
    config.status,
    api.providerManifests[config.domain]?.has_setup_flow,
    config.enabled,
  );

/**
 * Whether the viewer may change the owner and sharing of the provider instance:
 * only a music source carries them, and only whoever manages it may change them.
 */
export const canConfigureSourceAccess = (config: ProviderConfig) =>
  canManageSource(config) &&
  hasConfigurableAccess(config, api.providerManifests[config.domain]);
