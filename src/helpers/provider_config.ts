import { ProviderStatus } from "@/plugins/api/interfaces";

const PROVIDER_STATUS_TRANSLATION_KEYS: Record<ProviderStatus, string> = {
  [ProviderStatus.LOADED]: "settings.provider_status_loaded",
  [ProviderStatus.LOADING]: "settings.provider_status_loading",
  [ProviderStatus.DISABLED]: "settings.provider_status_disabled",
  [ProviderStatus.AUTH_REQUIRED]: "settings.provider_status_auth_required",
  [ProviderStatus.INCOMPATIBLE]: "settings.provider_status_incompatible",
  [ProviderStatus.ERROR]: "settings.provider_status_error",
};

// Support labels predate some provider domains and do not always use the same name.
const PROVIDER_SUPPORT_LABELS: Record<string, string> = {
  airplay_receiver: "airplay",
  opensubsonic: "subsonic",
  podcast_index: "podcast",
  podcastfeed: "podcast",
  sonos_s1: "sonos",
  spotify_connect: "Spotify Connect",
  subsonic_scrobble: "subsonic",
  sync_group: "Groups",
  universal_group: "Universal Group",
  ytmusic: "youtube_music",
};

export const canReconfigureProvider = (
  status?: ProviderStatus | null,
  hasSetupFlow?: boolean,
  enabled: boolean = true,
) => enabled && hasSetupFlow === true && status !== ProviderStatus.INCOMPATIBLE;

export const providerRequiresReconfiguration = (
  status?: ProviderStatus | null,
  hasSetupFlow?: boolean,
  enabled: boolean = true,
) =>
  status === ProviderStatus.AUTH_REQUIRED &&
  canReconfigureProvider(status, hasSetupFlow, enabled);

export const getProviderStatusTranslationKey = (status?: ProviderStatus | null) =>
  (status && PROVIDER_STATUS_TRANSLATION_KEYS[status]) ??
  "settings.provider_status_unknown";

export const getProviderSupportIssuesUrl = (domain: string) => {
  const label = PROVIDER_SUPPORT_LABELS[domain] ?? domain;
  return `https://github.com/music-assistant/support/issues?q=${encodeURIComponent(
    `is:issue state:open label:"${label}"`,
  )}`;
};
