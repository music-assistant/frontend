import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import {
  applicableSteps,
  checklistPendingSteps,
  checklistSteps,
  pendingSteps,
  type OnboardingContext,
  type OnboardingIntent,
  type OnboardingStepId,
} from "@/helpers/onboarding";
import { providerDisplayName } from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  EventType,
  Scope,
  type ProviderConfig,
  type ProviderType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

/** User preference holding the answer to the wizard's intent question. */
export const ONBOARDING_INTENT_PREFERENCE = "onboarding.intent";

/** A provider the wizard lists, built from its configuration. */
export interface ConfiguredProvider {
  instance_id: string;
  name: string;
  domain: string;
  // set up, but not doing anything: switched off or failed to load
  needsAttention: boolean;
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

// the load in flight, so a wizard and a checklist coming up together ask once
let loadingConfigs: Promise<void> | null = null;
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

/**
 * A provider that ships with the server rather than one the user set up. The
 * manifest owns that flag, so a provider whose manifest is missing is not
 * claimed to be builtin.
 */
function isBuiltinProvider(domain: string): boolean {
  return api.providerManifests[domain]?.builtin === true;
}

/** The providers of one type the user configured themselves. */
export function configuredProviders(type: ProviderType): ConfiguredProvider[] {
  return (providerConfigs.value ?? [])
    .filter(
      (config) => config.type === type && !isBuiltinProvider(config.domain),
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

const { getPreference } = useUserPreferences();
const intent = getPreference<OnboardingIntent>(ONBOARDING_INTENT_PREFERENCE);

const ctx = computed<OnboardingContext>(() => ({
  // the admin track sets up every kind of provider
  isAdmin: authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE),
  providers: (providerConfigs.value ?? []).map((config) => ({
    type: config.type,
    domain: config.domain,
    builtin: isBuiltinProvider(config.domain),
    enabled: config.enabled,
  })),
  // only the summary's "2 players" label reads this; whether the players step
  // is done keys off a configured PLAYER provider, not off players turning up
  playerCount: Object.keys(api.players).length,
  answers: { intent: intent.value },
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
 * Close onboarding off and leave the wizard, and say whether that worked. The
 * server completes onboarding by itself as soon as the first provider is added,
 * so the command is skipped once it says so and an answer that only repeats
 * that is not worth a word. Any other failure leaves onboarding open on the
 * server, so the wizard stays put with the error on screen rather than handing
 * the user back an app that will drop them in here again on the next reload.
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
    configsLoaded,
    loadProviderConfigs,
    finish,
  };
}
