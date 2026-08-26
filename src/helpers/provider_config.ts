import { ProviderStage, ProviderStatus } from "@/plugins/api/interfaces";

const PROVIDER_STATUS_TRANSLATION_KEYS: Record<ProviderStatus, string> = {
  [ProviderStatus.LOADED]: "settings.provider_status_loaded",
  [ProviderStatus.LOADING]: "settings.provider_status_loading",
  [ProviderStatus.DISABLED]: "settings.provider_status_disabled",
  [ProviderStatus.AUTH_REQUIRED]: "settings.provider_status_auth_required",
  [ProviderStatus.INCOMPATIBLE]: "settings.provider_status_incompatible",
  [ProviderStatus.ERROR]: "settings.provider_status_error",
};

const PROVIDER_STAGE_TRANSLATION_KEYS: Record<ProviderStage, string> = {
  [ProviderStage.ALPHA]: "settings.stage.options.alpha",
  [ProviderStage.BETA]: "settings.stage.options.beta",
  [ProviderStage.STABLE]: "settings.stage.options.stable",
  [ProviderStage.EXPERIMENTAL]: "settings.stage.options.experimental",
  [ProviderStage.UNMAINTAINED]: "settings.stage.options.unmaintained",
  [ProviderStage.DEPRECATED]: "settings.stage.options.deprecated",
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

// A retired provider fails to load as INCOMPATIBLE (the server reuses
// UnsupportedSystemError), so the stage is what tells the two apart.
export const getProviderStatusTranslationKey = (
  status?: ProviderStatus | null,
  stage?: ProviderStage | string | null,
) => {
  if (
    status === ProviderStatus.INCOMPATIBLE &&
    stage === ProviderStage.DEPRECATED
  )
    return "settings.provider_status_retired";
  return (
    (status && PROVIDER_STATUS_TRANSLATION_KEYS[status]) ??
    "settings.provider_status_unknown"
  );
};

// Returns undefined for an absent or unrecognised stage so callers can skip the badge
// entirely rather than render a raw key.
export const getProviderStageTranslationKey = (
  stage?: ProviderStage | string | null,
) => {
  if (!stage) return undefined;
  return Object.prototype.hasOwnProperty.call(
    PROVIDER_STAGE_TRANSLATION_KEYS,
    stage,
  )
    ? PROVIDER_STAGE_TRANSLATION_KEYS[stage as ProviderStage]
    : undefined;
};

export const getProviderSupportIssuesUrl = (domain: string) => {
  const label = PROVIDER_SUPPORT_LABELS[domain] ?? domain;
  return `https://github.com/music-assistant/support/issues?q=${encodeURIComponent(
    `is:issue state:open label:"${label}"`,
  )}`;
};
