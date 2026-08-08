import { ProviderStatus } from "@/plugins/api/interfaces";

const PROVIDER_STATUS_TRANSLATION_KEYS: Record<ProviderStatus, string> = {
  [ProviderStatus.LOADED]: "settings.provider_status_loaded",
  [ProviderStatus.LOADING]: "settings.provider_status_loading",
  [ProviderStatus.DISABLED]: "settings.provider_status_disabled",
  [ProviderStatus.AUTH_REQUIRED]: "settings.provider_status_auth_required",
  [ProviderStatus.INCOMPATIBLE]: "settings.provider_status_incompatible",
  [ProviderStatus.ERROR]: "settings.provider_status_error",
};

export const canReconfigureProvider = (
  status?: ProviderStatus,
  hasSetupFlow?: boolean,
  enabled: boolean = true,
) => enabled && hasSetupFlow === true && status !== ProviderStatus.INCOMPATIBLE;

export const providerRequiresReconfiguration = (
  status?: ProviderStatus,
  hasSetupFlow?: boolean,
  enabled: boolean = true,
) =>
  status === ProviderStatus.AUTH_REQUIRED &&
  canReconfigureProvider(status, hasSetupFlow, enabled);

export const getProviderStatusTranslationKey = (status?: ProviderStatus) =>
  (status && PROVIDER_STATUS_TRANSLATION_KEYS[status]) ??
  "settings.provider_status_unknown";

export const getProviderSupportIssuesUrl = (domain: string) =>
  `https://github.com/music-assistant/support/issues?q=${encodeURIComponent(
    `is:issue state:open label:"${domain}"`,
  )}`;
