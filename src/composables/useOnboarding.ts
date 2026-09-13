import {
  setUserPreference,
  setUserPreferences,
  useUserPreferences,
} from "@/composables/userPreferences";
import {
  applicableSteps,
  checklistPendingSteps,
  checklistSteps,
  PERSONA_DEFAULTS,
  pendingSteps,
  type OnboardingContext,
  type OnboardingIntent,
  type OnboardingPersona,
  type OnboardingStepId,
} from "@/helpers/onboarding";
import {
  isAdminTrack,
  isMemberTrack,
  ONBOARDING_INTENT_PREFERENCE,
  ONBOARDING_PERSONA_PREFERENCE,
  ONBOARDING_WELCOME_PREFERENCE,
} from "@/helpers/onboarding_access";
import { userDisplayName } from "@/helpers/provider_access";
import {
  isBuiltinProvider,
  providerDisplayName,
} from "@/helpers/provider_config";
import { isSystemUser } from "@/helpers/users";
import { api, type CommandOptions } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  EventType,
  Scope,
  UserRole,
  type ProviderConfig,
  type ProviderType,
  type User,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
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

// the load in flight, so a wizard and a checklist coming up together ask once
let loadingConfigs: Promise<void> | null = null;
// the same for the users, which only the wizard ever asks for
let loadingUsers: Promise<void> | null = null;
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

/**
 * Load everything the wizard decides from. The sidebar checklist asks for the
 * provider configurations on their own: it lists neither the household nor the
 * server settings, so it has no reason to make every admin session wait on the
 * users as well.
 */
async function loadOnboardingData(): Promise<void> {
  await Promise.all([loadProviderConfigs(), loadUsers()]);
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
const persona = getPreference<OnboardingPersona>(ONBOARDING_PERSONA_PREFERENCE);
const welcomedAt = getPreference<string>(ONBOARDING_WELCOME_PREFERENCE);

const ctx = computed<OnboardingContext>(() => ({
  // which track this session is on, which is what decides the steps below
  isAdmin: isAdminTrack(),
  isMember: isMemberTrack(),
  // the welcome has been shown before, which is all the marker on the account
  // says — and all the welcome needs it to say
  welcomed: welcomedAt.value != null,
  providers: (providerConfigs.value ?? []).map((config) => ({
    type: config.type,
    domain: config.domain,
    builtin: isBuiltinProvider(api.providerManifests[config.domain]),
    enabled: config.enabled,
  })),
  // only the summary's "2 players" label reads this; whether the players step
  // is done keys off a configured PLAYER provider, not off players turning up
  playerCount: Object.keys(api.players).length,
  // `null` while the users are unknown, which is not the same as an empty
  // household: the invite step is then simply not done
  memberCount: users.value == null ? null : householdMembers().length,
  answers: { intent: intent.value, persona: persona.value },
}));

const steps = computed(() => applicableSteps(ctx.value));
const pending = computed(() => pendingSteps(ctx.value));
// what the getting started checklist shows, and the steps of it its badge
// counts: the same list, so the count always matches what the popover lists
const checklist = computed(() => checklistSteps(ctx.value));
const checklistPending = computed(() => checklistPendingSteps(ctx.value));
const hasPending = computed(() => checklistPending.value.length > 0);

// The counted steps as they were when the checklist was last dismissed; the
// checklist stays hidden for the session until a step it did not list shows up.
const dismissedPending = ref<OnboardingStepId[] | null>(null);
const dismissed = computed(() => {
  const snapshot = dismissedPending.value;
  if (!snapshot) return false;
  return checklistPending.value.every((step) => snapshot.includes(step.id));
});

function dismiss(): void {
  dismissedPending.value = checklistPending.value.map((step) => step.id);
}

async function setIntent(value: OnboardingIntent): Promise<void> {
  await setUserPreference(ONBOARDING_INTENT_PREFERENCE, value);
}

/**
 * Answer the welcome's persona question, and seed the settings that answer
 * stands for. Both go out in one update, so the account never holds the answer
 * without what it was given for — and answering again simply seeds them again.
 * Nothing reads the persona itself afterwards: every one of those settings
 * stays the member's to change. Says whether the answer landed, because a
 * question that quietly did not save is worse than one asked again — and the
 * step that asked it says so itself, which is one message, not two.
 */
async function setPersona(value: OnboardingPersona): Promise<boolean> {
  return await setUserPreferences(
    {
      [ONBOARDING_PERSONA_PREFERENCE]: value,
      ...PERSONA_DEFAULTS[value],
    },
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
    dismiss();
    await router.replace({ name: "discover" });
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
  // the wizard has had its say; keep the checklist out of the way afterwards
  dismiss();
  await router.replace({ name: "discover" });
  return true;
}

/**
 * Live onboarding state, shared by the wizard page and the sidebar checklist.
 * Module-level on purpose: dismissing the checklist has to hold for the
 * session, whichever component is mounted.
 */
export function useOnboarding() {
  return {
    ctx,
    steps,
    pending,
    checklist,
    checklistPending,
    hasPending,
    dismissed,
    dismiss,
    intent,
    setIntent,
    persona,
    setPersona,
    // what the wizard marks the welcome with on the way out of it
    markWelcomed,
    dataLoaded,
    loadOnboardingData,
    // the checklist's own pair: it decides off the provider configurations
    // alone, so it waits for nothing else
    configsLoaded,
    loadProviderConfigs,
    // what a step that has just added a member asks for the users again with
    loadUsers,
    finish,
  };
}
