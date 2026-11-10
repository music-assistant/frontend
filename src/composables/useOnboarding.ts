import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import {
  applicableSteps,
  pendingSteps,
  type OnboardingContext,
  type OnboardingIntent,
  type OnboardingStepId,
} from "@/helpers/onboarding";
import { getPlayerName } from "@/helpers/player_settings_actions";
import {
  isBuiltinProvider,
  providerDisplayName,
} from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  EventType,
  PlayerType,
  type EventMessage,
  type Player,
  type PlayerConfig,
  type ProviderConfig,
  type ProviderStatus,
  type ProviderType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

/** User preference holding the answer to the wizard's intent question. */
const ONBOARDING_INTENT_PREFERENCE = "onboarding.intent";

/** A provider the wizard lists, built from its configuration. */
export interface ConfiguredProvider {
  instance_id: string;
  name: string;
  domain: string;
  // set up, but not doing anything: switched off or failed to load
  needsAttention: boolean;
  status: ProviderStatus | null;
}

/** A player the wizard lists, built from its configuration and live state. */
export interface DiscoveredPlayer {
  player_id: string;
  // the name the player goes by, custom or as its provider reports it
  name: string;
  // the name the user gave it, if any
  customName: string | null;
  // where it came from, as the user would say it: its provider, or the
  // protocols a player of a builtin provider plays through
  providerLabel: string;
  enabled: boolean;
  // reachable right now; a player that is switched off never is
  available: boolean;
  needsSetup: boolean;
  icon: string | null;
  // switching it on or off takes its provider, which has to be running
  canToggle: boolean;
}

/**
 * The provider configurations, the same list the providers settings page works
 * from: `api.providers` only holds the instances that loaded, so a provider
 * that is switched off or failed to start is nowhere to be seen there.
 * `null` until the first load lands, so nothing decides anything on an empty
 * list it has not asked for yet.
 */
const providerConfigs = ref<ProviderConfig[] | null>(null);

/**
 * The player configurations, the same list the players settings page works
 * from: a player that is switched off is unregistered and so nowhere to be
 * seen in `api.players`, yet it is the wizard's to switch back on. `null`
 * until the first load lands.
 */
const playerConfigs = ref<PlayerConfig[] | null>(null);

// the load in flight, so overlapping callers share the one request
let loadingConfigs: Promise<void> | null = null;
// and for the players
let loadingPlayers: Promise<void> | null = null;
// the session's subscription: this state has no component to outlive, so it is
// taken out once, on the first call, and kept for as long as the app runs
let unsubProvidersUpdated: (() => void) | undefined;

async function fetchProviderConfigs(): Promise<void> {
  try {
    providerConfigs.value = await api.getProviderConfigs();
  } catch (error) {
    // the api already told the user; leaving the list unloaded keeps the wizard
    // waiting instead of claiming nothing is set up
    console.warn("Failed to load the provider configurations:", error);
  }
}

/**
 * Load the provider configurations and keep them up to date. Only whoever asks
 * pays for it: a guest, a dashboard viewer or anyone who is not an admin never
 * calls this, so the list is never fetched for them.
 */
async function loadProviderConfigs(): Promise<void> {
  unsubProvidersUpdated ??= api.subscribe(EventType.PROVIDERS_UPDATED, () => {
    void fetchProviderConfigs();
  });
  loadingConfigs ??= fetchProviderConfigs().finally(() => {
    loadingConfigs = null;
  });
  await loadingConfigs;
}

async function fetchPlayerConfigs(): Promise<void> {
  // the list is empty rather than unknown while the request is out, so a
  // player that turns up in the meantime is taken in and kept: the answer is
  // merged in over it instead of replacing it
  playerConfigs.value = [];
  try {
    // every player that registered, and the switched-off ones on top: those
    // are unregistered, and this is where they are switched back on. One that
    // is switched on but not around is left out, as on the players settings
    // page.
    const configs = await api.getPlayerConfigs(undefined, false, false, true);
    for (const config of configs) upsertPlayerConfig(config);
  } catch (error) {
    // the api already told the user
    console.warn("Failed to load the player configurations:", error);
  }
}

/** Load the player configurations, sharing the request between callers. */
async function loadPlayerConfigs(): Promise<void> {
  loadingPlayers ??= fetchPlayerConfigs().finally(() => {
    loadingPlayers = null;
  });
  await loadingPlayers;
}

/**
 * Load everything the wizard decides from: the provider configurations and the
 * players.
 */
async function loadOnboardingData(): Promise<void> {
  await Promise.all([loadProviderConfigs(), loadPlayerConfigs()]);
}

function findPlayerConfig(playerId: string): PlayerConfig | undefined {
  return playerConfigs.value?.find((config) => config.player_id === playerId);
}

function upsertPlayerConfig(config: PlayerConfig): void {
  // nothing to keep up to date before the first load is asked for
  if (playerConfigs.value === null) return;
  const index = playerConfigs.value.findIndex(
    (known) => known.player_id === config.player_id,
  );
  if (index === -1) playerConfigs.value.push(config);
  else playerConfigs.value[index] = config;
}

function removePlayerConfig(playerId: string): void {
  playerConfigs.value =
    playerConfigs.value?.filter((known) => known.player_id !== playerId) ??
    null;
}

async function fetchPlayerConfig(playerId: string): Promise<void> {
  try {
    const config = await api.getPlayerConfig(playerId);
    // unless it turned up by another route in the meantime, or was gone again
    // before its configuration came in
    if (!findPlayerConfig(playerId) && playerId in api.players) {
      upsertPlayerConfig(config);
    }
  } catch (error) {
    // the api already told the user
    console.warn("Failed to load the player configuration:", error);
  }
}

function onPlayerEvent(evt: EventMessage): void {
  if (evt.event === EventType.PLAYER_CONFIG_UPDATED) {
    upsertPlayerConfig(evt.data as PlayerConfig);
  } else if (evt.event === EventType.PLAYER_ADDED) {
    // a player seen before only came back, and what it is listed by has not
    // changed; a new one has a configuration of its own to fetch, unless it is
    // one output of another player, which is configured as part of that one
    const player = evt.data as Player;
    if (
      playerConfigs.value !== null &&
      player.type !== PlayerType.PROTOCOL &&
      !findPlayerConfig(player.player_id)
    ) {
      void fetchPlayerConfig(player.player_id);
    }
  } else if (evt.event === EventType.PLAYER_REMOVED) {
    // a switched-off player is unregistered but keeps its configuration, which
    // is what the wizard lists it by; one that was switched on is gone
    const config = evt.object_id ? findPlayerConfig(evt.object_id) : undefined;
    if (config?.enabled) removePlayerConfig(config.player_id);
  }
}

/**
 * Keep the players up to date while the wizard is open, and hand back what
 * stops it. Only the wizard follows them: a session that is done onboarding
 * has no business fetching a configuration for every player that turns up.
 */
function followPlayers(): () => void {
  return api.subscribe_multi(
    [
      EventType.PLAYER_CONFIG_UPDATED,
      EventType.PLAYER_ADDED,
      EventType.PLAYER_REMOVED,
    ],
    onPlayerEvent,
  );
}

/** The providers of one type the user configured themselves. */
export function configuredProviders(type: ProviderType): ConfiguredProvider[] {
  return (providerConfigs.value ?? [])
    .filter(
      (config) =>
        config.type === type &&
        !isBuiltinProvider(api.providerManifests[config.domain]),
    )
    .map((config) => ({
      instance_id: config.instance_id,
      name:
        providerDisplayName(
          config,
          api.providers[config.instance_id],
          api.providerManifests[config.domain],
        ) || config.domain,
      domain: config.domain,
      needsAttention: config.enabled === false || config.last_error != null,
      status: config.status,
    }));
}

// what a player of a builtin provider was last labelled with while it was
// registered: switching it off unregisters it, and its outputs with it
const lastPlayerLabels = new Map<string, string>();

/**
 * Where a player came from, as the user would say it: its provider, by the
 * same name the provider badges use. A builtin provider is the server's own
 * machinery rather than a place a player came from: a player of one plays
 * through protocols such as AirPlay or Chromecast, and those are what it is
 * labelled with, for as long as the wizard knows them.
 */
function playerProviderLabel(config: PlayerConfig, player?: Player): string {
  const instance = api.providers[config.provider];
  const providerConfig = providerConfigs.value?.find(
    (known) => known.instance_id === config.provider,
  );
  const domain =
    instance?.domain ??
    providerConfig?.domain ??
    config.provider.split("--")[0];
  const manifest = api.providerManifests[domain];
  if (!isBuiltinProvider(manifest)) {
    // the configuration knows the name of a provider that is not running
    return providerConfig
      ? providerDisplayName(providerConfig, instance, manifest) || domain
      : instance?.name || manifest?.name || domain;
  }
  const protocols = new Set(
    (player?.output_protocols ?? [])
      .filter((protocol) => !protocol.is_native)
      .map(
        (protocol) =>
          api.providerManifests[protocol.protocol_domain]?.name ||
          protocol.name,
      ),
  );
  if (protocols.size > 0) {
    const label = [...protocols].join(", ");
    lastPlayerLabels.set(config.player_id, label);
    return label;
  }
  // the last label stands in only while the player is unregistered: one that
  // is around and plays through nothing is labelled by its provider
  return (
    (player ? undefined : lastPlayerLabels.get(config.player_id)) ??
    (instance?.name || manifest?.name || domain)
  );
}

/**
 * The configurations the wizard lists. A protocol player is one output of
 * another player and is set up as part of it, so it is not listed on its own.
 */
function listedPlayerConfigs(): PlayerConfig[] {
  return (playerConfigs.value ?? []).filter(
    (config) => config.player_type !== PlayerType.PROTOCOL,
  );
}

/** The players found so far, switched-off ones included, by name. */
export function discoveredPlayers(): DiscoveredPlayer[] {
  return listedPlayerConfigs()
    .map((config) => {
      const player = api.players[config.player_id];
      return {
        player_id: config.player_id,
        name: getPlayerName(config),
        customName: config.name,
        providerLabel: playerProviderLabel(config, player),
        enabled: config.enabled,
        available: player?.available ?? false,
        needsSetup: player?.needs_setup ?? false,
        icon: player?.icon ?? null,
        canToggle: config.provider in api.providers,
      };
    })
    .sort((one, other) => one.name.localeCompare(other.name));
}

const { getPreference } = useUserPreferences();
const intent = getPreference<OnboardingIntent>(ONBOARDING_INTENT_PREFERENCE);

const ctx = computed<OnboardingContext>(() => ({
  providers: (providerConfigs.value ?? []).map((config) => ({
    type: config.type,
    domain: config.domain,
    builtin: isBuiltinProvider(api.providerManifests[config.domain]),
    enabled: config.enabled,
  })),
  // the players switched on, as the players step lists them; only the
  // summary's "2 players" label reads this, as whether the step is done keys
  // off a configured PLAYER provider, not off players turning up
  playerCount: listedPlayerConfigs().filter((config) => config.enabled).length,
  answers: { intent: intent.value },
}));

const steps = computed(() => applicableSteps(ctx.value));
const pending = computed(() => pendingSteps(ctx.value));

// Whether the onboarding modal is open, and the step it should open on when it
// is (`null` falls back to the first step still to do). The wizard keeps the
// step up to date as it moves, so a paused setup opens again where it was.
// Module-level so the same modal is driven from the app shell and the settings
// page.
const active = ref(false);
const requestedStep = ref<OnboardingStepId | null>(null);
// a setup put aside, which a reconnect leaves aside
const paused = ref(false);
// the paused banner was dismissed, which hides it but keeps the setup aside
const pausedBannerDismissed = ref(false);
const showPausedBanner = computed(
  () => paused.value && !pausedBannerDismissed.value,
);
// counts each time the wizard opens, so a pause only acts on the opening it
// started on and never on a wizard resumed while its save was on its way
let opening = 0;

function open(step?: OnboardingStepId): void {
  if (step) requestedStep.value = step;
  paused.value = false;
  pausedBannerDismissed.value = false;
  if (!active.value) opening++;
  active.value = true;
}

function close(): void {
  active.value = false;
  paused.value = false;
  pausedBannerDismissed.value = false;
  requestedStep.value = null;
}

// what lets the step on screen save before the setup is put aside; the
// wizard's to set while it is open
let leaveCurrentStep: (() => Promise<boolean>) | null = null;
// the opening a pause is saving for, if any
let pausingOpening: number | null = null;

/** Let the step on screen save before a pause; hands back what undoes it. */
function setStepGuard(guard: () => Promise<boolean>): () => void {
  leaveCurrentStep = guard;
  return () => {
    // a wizard that has already taken over keeps its own guard
    if (leaveCurrentStep === guard) leaveCurrentStep = null;
  };
}

/** Hide the open setup and offer to resume it, without asking its step. */
function setAside(): void {
  if (!active.value) return;
  active.value = false;
  paused.value = true;
}

/**
 * Put the setup aside, keeping its step for whenever it is resumed. The step on
 * screen saves first, as it does on Next; a step that cannot keeps the wizard
 * open, unless `force` says the user has already left it.
 */
async function pause(options?: { force?: boolean }): Promise<void> {
  if (!active.value) return;
  const started = opening;
  if (pausingOpening === started) {
    // the user went to another page while a pause was saving: they have left,
    // so the wizard goes now, whatever that save turns out to be
    if (options?.force) setAside();
    return;
  }
  pausingOpening = started;
  try {
    const saved = (await leaveCurrentStep?.()) ?? true;
    if (opening === started && (saved || options?.force)) setAside();
  } finally {
    if (pausingOpening === started) pausingOpening = null;
  }
}

/** Stop offering to resume a paused setup; the settings still resume it. */
function dismissPaused(): void {
  pausedBannerDismissed.value = true;
}

/** Answer the setup's intent question, and say whether the answer landed. */
async function setIntent(value: OnboardingIntent): Promise<boolean> {
  return await setUserPreference(ONBOARDING_INTENT_PREFERENCE, value);
}

// InvalidDataError: the command is still registered, but onboarding was already
// completed, by another session for instance.
const INVALID_DATA_ERROR_CODE = 3;
// InvalidCommand: a server restarted after onboarding completed no longer
// registers the command.
const INVALID_COMMAND_ERROR_CODE = 12;

/**
 * Whether the server is only saying onboarding was already closed off. Both
 * answers mean the same thing, and neither is worth a word to the user.
 */
function isAlreadyCompletedError(error: unknown): boolean {
  return (
    error instanceof ApiCommandError &&
    (error.error_code === INVALID_COMMAND_ERROR_CODE ||
      error.error_code === INVALID_DATA_ERROR_CODE)
  );
}

/**
 * Close onboarding off and leave the wizard, and say whether that worked.
 *
 * A server that already says onboarding is done is not asked again, and an
 * answer that only repeats that is not worth a word. Any other failure leaves
 * onboarding open on the server, so the wizard stays put with the error on
 * screen rather than handing the user back an app that will drop them in here
 * again on the next reload.
 */
async function finish(): Promise<boolean> {
  if (api.serverInfo.value?.onboard_done === false) {
    try {
      await api.sendCommand("config/onboard_complete", undefined, {
        suppressGlobalError: true,
      });
    } catch (error) {
      if (!isAlreadyCompletedError(error)) {
        console.warn("Failed to complete onboarding:", error);
        toast.error($t("onboarding.finish_failed"));
        return false;
      }
    }
  }
  close();
  return true;
}

/**
 * Live onboarding state, shared by the modal, the app shell and the settings
 * page. Module-level on purpose: the open state has to hold across the routes
 * the modal sits over, whichever component asked for it.
 */
export function useOnboarding() {
  return {
    ctx,
    steps,
    pending,
    // the modal's open state, and the pair that drives it from anywhere
    active,
    requestedStep,
    open,
    close,
    pause,
    paused,
    showPausedBanner,
    dismissPaused,
    setStepGuard,
    intent,
    setIntent,
    loadOnboardingData,
    // what the wizard keeps the players up to date with while it is open
    followPlayers,
    finish,
  };
}
