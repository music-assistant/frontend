import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import {
  applicableSteps,
  pendingSteps,
  requiredPendingSteps,
  type OnboardingContext,
  type OnboardingIntent,
  type OnboardingStepId,
} from "@/helpers/onboarding";
import { api } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import type { ProviderInstance, ProviderType } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import router from "@/plugins/router";
import { computed, ref } from "vue";

/** User preference holding the answer to the wizard's intent question. */
export const ONBOARDING_INTENT_PREFERENCE = "onboarding.intent";

/**
 * A provider that ships with the server rather than one the user set up. The
 * manifest owns that flag, so a provider whose manifest is missing is not
 * claimed to be builtin.
 */
function isBuiltinProvider(provider: ProviderInstance): boolean {
  return api.providerManifests[provider.domain]?.builtin === true;
}

/** The providers of one type the user configured themselves. */
export function configuredProviders(type: ProviderType): ProviderInstance[] {
  return Object.values(api.providers).filter(
    (provider) => provider.type === type && !isBuiltinProvider(provider),
  );
}

const { getPreference } = useUserPreferences();
const intent = getPreference<OnboardingIntent>(ONBOARDING_INTENT_PREFERENCE);

const ctx = computed<OnboardingContext>(() => ({
  isAdmin: authManager.isAdmin(),
  providers: Object.values(api.providers).map((provider) => ({
    type: provider.type,
    domain: provider.domain,
    builtin: isBuiltinProvider(provider),
  })),
  // only the summary's "2 players" label reads this; whether the players step
  // is done keys off a configured PLAYER provider, not off players turning up
  playerCount: Object.keys(api.players).length,
  answers: { intent: intent.value },
}));

const steps = computed(() => applicableSteps(ctx.value));
const pending = computed(() => pendingSteps(ctx.value));
// the checklist only ever asks for the steps that block finishing
const requiredPending = computed(() => requiredPendingSteps(ctx.value));
const hasPending = computed(() => requiredPending.value.length > 0);

// The required steps as they were when the checklist was last dismissed; the
// checklist stays hidden for the session until a step it did not list shows up.
const dismissedPending = ref<OnboardingStepId[] | null>(null);
const dismissed = computed(() => {
  const snapshot = dismissedPending.value;
  if (!snapshot) return false;
  return requiredPending.value.every((step) => snapshot.includes(step.id));
});

function dismiss(): void {
  dismissedPending.value = requiredPending.value.map((step) => step.id);
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
 * Close onboarding off and leave the wizard. The server completes onboarding by
 * itself as soon as the first provider is added, so the command is skipped once
 * it says so and its failures are expected rather than shown: finishing the
 * wizard must never end on an error toast.
 */
async function finish(): Promise<void> {
  if (api.serverInfo.value?.onboard_done === false) {
    try {
      await api.sendCommand("config/onboard_complete", undefined, {
        suppressGlobalError: true,
      });
    } catch (error) {
      if (!isAlreadyCompletedError(error)) {
        console.warn("Failed to complete onboarding:", error);
      }
    }
  }
  // the wizard has had its say; keep the checklist out of the way afterwards
  dismiss();
  await router.replace({ name: "discover" });
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
    requiredPending,
    hasPending,
    dismissed,
    dismiss,
    intent,
    setIntent,
    finish,
  };
}
