import {
  leaveFirstRunSetup,
  useFirstRunSetup,
} from "@/composables/useFirstRunSetup";
import {
  setUserPreference,
  setUserPreferences,
  useUserPreferences,
} from "@/composables/userPreferences";
import { EXPERT_MODE_PREFERENCE, expertModeOf } from "@/helpers/expert_mode";
import {
  applicableSteps,
  pendingSteps,
  type OnboardingContext,
  type OnboardingIntent,
  type OnboardingStepId,
} from "@/helpers/onboarding";
import {
  isAdminTrack,
  isMemberTrack,
  ONBOARDING_INTENT_PREFERENCE,
  ONBOARDING_WELCOME_PREFERENCE,
} from "@/helpers/onboarding_access";
import { getPlayerName } from "@/helpers/player_config";
import {
  isOwnMusicSource,
  ownedMusicSourceCount,
  userDisplayName,
} from "@/helpers/provider_access";
import {
  isBuiltinProvider,
  providerDisplayName,
} from "@/helpers/provider_config";
import { isSystemUser } from "@/helpers/users";
import { isHiddenSendspinWebPlayer } from "@/helpers/utils";
import { api, type CommandOptions } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  EventType,
  PlayerType,
  Scope,
  UserRole,
  type EventMessage,
  type Player,
  type PlayerConfig,
  type ProviderConfig,
  type ProviderType,
  type User,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

/** A provider the wizard lists, built from its configuration. */
export interface ConfiguredProvider {
  instance_id: string;
  name: string;
  domain: string;
  // set up, but not doing anything: switched off or failed to load
  needsAttention: boolean;
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

/** A household member the wizard lists, built from their user account. */
export interface HouseholdMember {
  user_id: string;
  name: string;
  role: string;
}

/**
 * The provider configurations, the same list the providers settings page works
 * from: `api.providers` only holds the instances that loaded, so a provider
 * that is switched off or failed to start is nowhere to be seen there.
 * `null` until the first load lands, so nothing decides anything on an empty
 * list it has not asked for yet.
 */
const providerConfigs = ref<ProviderConfig[] | null>(null);
const configsLoaded = computed(() => providerConfigs.value !== null);

/**
 * The user accounts, `null` until the server lists them — and after a load that
 * failed, which leaves the household unknown rather than empty.
 */
const users = ref<User[] | null>(null);
// whether the users have been asked for and answered, however that turned out:
// the wizard waits for an answer, not for an answer it likes
const usersAnswered = ref(false);

/** Whether everything the steps decide from has answered. */
const dataLoaded = computed(() => configsLoaded.value && usersAnswered.value);

/**
 * The player configurations, the same list the players settings page works
 * from: a player that is switched off is unregistered and so nowhere to be
 * seen in `api.players`, yet it is the wizard's to switch back on. `null`
 * until the first load lands.
 */
const playerConfigs = ref<PlayerConfig[] | null>(null);

// the load in flight, so overlapping callers share the one request
let loadingConfigs: Promise<void> | null = null;
// the same for the users, which only the wizard ever asks for
let loadingUsers: Promise<void> | null = null;
// and for the players
let loadingPlayers: Promise<void> | null = null;
// the session's subscription: this state has no component to outlive, so it is
// taken out once, on the first call, and kept for as long as the app runs
let unsubProvidersUpdated: (() => void) | undefined;

async function fetchProviderConfigs(): Promise<void> {
  // listing the configurations is a permission of its own, which a custom role
  // may well not hold: whoever may not read them is answered with the empty
  // list they can see, instead of a request that only fails at them
  if (!authManager.hasScope(Scope.CONFIG_PROVIDERS_READ)) {
    providerConfigs.value = [];
    return;
  }
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

async function fetchUsers(): Promise<void> {
  // listing the accounts is what the user management screen is allowed on, so
  // whoever may not open that is answered without a request going out
  if (!authManager.hasScope(Scope.USERS_READ)) {
    usersAnswered.value = true;
    return;
  }
  try {
    users.value = await api.getAllUsers();
  } catch (error) {
    // the api already told the user; a refresh that did not land leaves the
    // household unknown rather than stale, and the invite step is then simply
    // not done, which being optional holds nothing up
    users.value = null;
    console.warn("Failed to load the users:", error);
  } finally {
    usersAnswered.value = true;
  }
}

/**
 * Load the user accounts. The household is only ever asked about on the admin
 * track, and listing the accounts is a permission of its own, so nobody who
 * lacks it fetches them.
 */
async function loadUsers(): Promise<void> {
  loadingUsers ??= fetchUsers().finally(() => {
    loadingUsers = null;
  });
  await loadingUsers;
}

async function fetchPlayerConfigs(): Promise<void> {
  // whoever may not read the player configurations is answered with the empty
  // list they can see, instead of a request that only fails at them
  if (!authManager.hasScope(Scope.CONFIG_PLAYERS_READ)) {
    playerConfigs.value = [];
    return;
  }
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
 * Load everything the admin wizard decides from: the provider configurations,
 * the players and the household. The member welcome asks for the provider
 * configurations on its own when it needs them, so it never waits on the rest.
 */
async function loadOnboardingData(): Promise<void> {
  await Promise.all([loadProviderConfigs(), loadPlayerConfigs(), loadUsers()]);
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
  if (!authManager.hasScope(Scope.CONFIG_PLAYERS_READ)) return () => {};
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
 * another player and is set up as part of it, so it is not listed on its own;
 * and the web players this app spawns come and go with every browser tab, so
 * one that is not around is nothing anyone set up.
 */
function listedPlayerConfigs(): PlayerConfig[] {
  return (playerConfigs.value ?? []).filter(
    (config) =>
      config.player_type !== PlayerType.PROTOCOL &&
      !isHiddenSendspinWebPlayer(config),
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

/**
 * Someone who lives here, as opposed to an account that is not a person: the
 * Home Assistant integration's, a service account or a guest, who is only ever
 * passing through. A disabled account is nobody who lives here either: it is
 * an account that cannot be used until an admin switches it back on.
 */
function isHouseholdMember(user: User): boolean {
  return (
    user.enabled &&
    !isSystemUser(user) &&
    user.role !== UserRole.GUEST &&
    user.role !== UserRole.SERVICE
  );
}

/** The household members, in the order the server lists them. */
export function householdMembers(): HouseholdMember[] {
  return (users.value ?? []).filter(isHouseholdMember).map((user) => ({
    user_id: user.user_id,
    name: userDisplayName(user),
    role: user.role,
  }));
}

const { getPreference } = useUserPreferences();
const intent = getPreference<OnboardingIntent>(ONBOARDING_INTENT_PREFERENCE);
const expertModeFlag = getPreference<boolean>(EXPERT_MODE_PREFERENCE);
// what an account holds that answered the welcome before the flag existed
const legacyPersona = getPreference<string>("onboarding.persona");
// the welcome's answer, undefined until it was given
const expertMode = computed(() =>
  expertModeOf(expertModeFlag.value, legacyPersona.value),
);
const welcomedAt = getPreference<string>(ONBOARDING_WELCOME_PREFERENCE);
const { firstRun } = useFirstRunSetup();

// the music sources this member owns, for the own-sources step to list and
// for the context to count; only ever non-empty once configs are loaded
const ownedMusicSources = computed(() =>
  (providerConfigs.value ?? []).filter((config) =>
    isOwnMusicSource(config, store.currentUser?.user_id),
  ),
);

const ctx = computed<OnboardingContext>(() => ({
  // which track this session is on, which is what decides the steps below
  isAdmin: isAdminTrack(),
  // a first run is the admin's: the account it makes is theirs from the moment
  // it is signed in, before the permissions that would say so are in
  isMember: !firstRun.value && isMemberTrack(),
  // a fresh server's first run: the account step comes first, and the admin
  // track is this session's from before there is an account to sign in with
  firstRun: firstRun.value,
  signedIn: store.currentUser != null,
  // the welcome has been shown before, which is all the marker on the account
  // says — and all the welcome needs it to say
  welcomed: welcomedAt.value != null,
  canOwnSources: authManager.hasScope(Scope.CONFIG_PROVIDERS_OWN),
  ownedMusicSourceCount: ownedMusicSourceCount(
    providerConfigs.value ?? [],
    store.currentUser?.user_id,
  ),
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
  // `null` while the users are unknown, which is not the same as an empty
  // household: the invite step is then simply not done
  memberCount: users.value == null ? null : householdMembers().length,
  answers: { intent: intent.value, expert: expertMode.value },
}));

const steps = computed(() => applicableSteps(ctx.value));
const pending = computed(() => pendingSteps(ctx.value));

// Whether the onboarding modal is open, and the step it should open on when it
// is (`null` falls back to the first step still to do). Module-level so the
// same modal is driven from the app shell, the settings page and the sign-in
// flow, and stays open across the routes it sits over.
const active = ref(false);
const requestedStep = ref<OnboardingStepId | null>(null);

function open(step?: OnboardingStepId): void {
  requestedStep.value = step ?? null;
  active.value = true;
}

function close(): void {
  active.value = false;
  requestedStep.value = null;
}

/** Answer the setup's intent question, and say whether the answer landed. */
async function setIntent(value: OnboardingIntent): Promise<boolean> {
  return await setUserPreference(ONBOARDING_INTENT_PREFERENCE, value);
}

/**
 * Answer the welcome's question with whether the member wants the expert
 * experience. The flag is all that is written: the display settings that come
 * with it read the flag wherever they apply, and every one of them stays the
 * member's to change. Says whether the answer landed, because a question that
 * quietly did not save is worse than one asked again, and the step that asked
 * it says so itself, which is one message, not two.
 */
async function setExpertMode(value: boolean): Promise<boolean> {
  return await setUserPreferences(
    { [EXPERT_MODE_PREFERENCE]: value },
    { suppressGlobalError: true },
  );
}

// The write in flight and whose marker it is, so the two ways out of the
// welcome — finishing it and leaving the page behind — never turn into two
// updates, while the next account to be welcomed still gets a write of its
// own instead of an answer about somebody else's marker.
let writingWelcomed: {
  userId?: string;
  write: Promise<boolean>;
} | null = null;

/**
 * Remember that the member has been welcomed, and say whether the account took
 * it. Only the first time counts: the marker says the welcome has been shown,
 * not when it was last opened, so a marker that is already there is an answer
 * of its own. A second caller for the same account joins the write already on
 * its way rather than sending the marker twice, which is the one the options
 * belong to.
 */
async function markWelcomed(options?: CommandOptions): Promise<boolean> {
  if (welcomedAt.value != null) return true;
  const userId = store.currentUser?.user_id;
  // the write on its way is only this caller's when it is this account's
  const marking = writingWelcomed;
  if (marking && marking.userId === userId) return await marking.write;

  const write = setUserPreferences(
    { [ONBOARDING_WELCOME_PREFERENCE]: new Date().toISOString() },
    options,
  ).finally(() => {
    // unless somebody else's is on its way by now, which is not this one's to
    // clear
    if (writingWelcomed?.write === write) writingWelcomed = null;
  });
  writingWelcomed = { userId, write };
  return await write;
}

// InvalidDataError: the server is still registering the command but has already
// completed onboarding itself.
const INVALID_DATA_ERROR_CODE = 3;
// InvalidCommand: the server dropped the command when it completed onboarding.
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
 * On the member track there is nothing to close off: the server's onboarding is
 * the admin's setup, and all the welcome leaves behind is the marker on the
 * member's own account.
 *
 * On the admin track the server completes onboarding by itself as soon as the
 * first provider is added, so the command is skipped once it says so and an
 * answer that only repeats that is not worth a word. Any other failure leaves
 * onboarding open on the server, so the wizard stays put with the error on
 * screen rather than handing the user back an app that will drop them in here
 * again on the next reload.
 */
async function finish(): Promise<boolean> {
  if (ctx.value.isMember) {
    // the marker is the whole of what the welcome leaves behind: a member
    // handed back to the app without it would be welcomed all over again, and
    // the wizard saying so is the only message they need about it
    if (!(await markWelcomed({ suppressGlobalError: true }))) {
      toast.error($t("onboarding.finish_failed"));
      return false;
    }
    close();
    return true;
  }
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
  // a first run ends with the wizard that hosted it: run again from the
  // settings, the setup is the one every other session gets
  leaveFirstRunSetup();
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
    intent,
    setIntent,
    expertMode,
    setExpertMode,
    // what the wizard marks the welcome with on the way out of it
    markWelcomed,
    dataLoaded,
    loadOnboardingData,
    configsLoaded,
    loadProviderConfigs,
    // the music sources the member owns, for the own-sources step to list
    ownedMusicSources,
    // what a step that has just added a member asks for the users again with
    loadUsers,
    // what the wizard keeps the players up to date with while it is open
    followPlayers,
    finish,
  };
}
