<template>
  <div class="flex w-full flex-col gap-5" data-testid="onboarding-wizard">
    <header class="flex flex-col gap-3">
      <p class="text-muted-foreground text-sm">{{ $t(trackTitleKey) }}</p>
      <template v-if="ready && currentStep">
        <div class="flex min-w-0 items-center gap-2">
          <Button
            v-if="canGoBack"
            variant="ghost"
            size="icon"
            class="-ml-2 shrink-0"
            :disabled="moving"
            :aria-label="$t('back')"
            :title="$t('back')"
            data-testid="onboarding-back"
            @click="back"
          >
            <ArrowLeft class="size-4" />
          </Button>
          <h1
            ref="stepHeading"
            class="truncate text-xl font-semibold"
            tabindex="-1"
            data-testid="onboarding-heading"
          >
            {{ stepTitle }}
          </h1>
        </div>
        <div class="flex items-center gap-3">
          <OnboardingProgress
            class="min-w-0 flex-1"
            :steps="progressSteps"
            :current="currentIndex"
            @navigate="jumpTo"
          />
          <span class="text-muted-foreground shrink-0 text-sm">
            {{
              $t("onboarding.step_counter", {
                current: stepNumber,
                total: steps.length,
              })
            }}
          </span>
        </div>
      </template>
    </header>

    <div
      v-if="!ready"
      class="flex min-h-40 items-center justify-center"
      data-testid="onboarding-loading"
    >
      <Spinner class="size-6" />
    </div>

    <component
      :is="stepView.component"
      v-else-if="stepView"
      :key="currentId"
      ref="stepRef"
      v-bind="stepView.props"
      @advance="next"
      @navigate="goTo"
      @finish="finishOnboarding"
    />

    <footer v-if="ready && showForwardAction" class="flex items-center gap-2">
      <Button
        :disabled="moving || stepBusy"
        data-testid="onboarding-next"
        @click="next"
      >
        {{ forwardLabel }}
      </Button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import OnboardingProgress from "@/components/onboarding/OnboardingProgress.vue";
import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import FinishStep from "@/components/onboarding/steps/FinishStep.vue";
import IntentStep from "@/components/onboarding/steps/IntentStep.vue";
import InviteMembersStep from "@/components/onboarding/steps/InviteMembersStep.vue";
import OwnSourcesStep from "@/components/onboarding/steps/OwnSourcesStep.vue";
import ProvidersStep from "@/components/onboarding/steps/ProvidersStep.vue";
import TourStep from "@/components/onboarding/steps/TourStep.vue";
import WelcomeStep from "@/components/onboarding/steps/WelcomeStep.vue";
import YourMusicStep from "@/components/onboarding/steps/YourMusicStep.vue";
import YourPlayersStep from "@/components/onboarding/steps/YourPlayersStep.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOnboarding } from "@/composables/useOnboarding";
import { firstStep, type OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ArrowLeft } from "@lucide/vue";
import {
  computed,
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Component,
} from "vue";

const {
  ctx,
  steps,
  requestedStep,
  loadOnboardingData,
  loadProviderConfigs,
  markWelcomed,
  finish,
} = useOnboarding();

const STEP_VIEWS: Record<
  OnboardingStepId,
  { component: Component; props?: Record<string, unknown> }
> = {
  intent: { component: markRaw(IntentStep) },
  music_sources: {
    component: markRaw(ProvidersStep),
    props: { providerType: ProviderType.MUSIC },
  },
  players: {
    component: markRaw(ProvidersStep),
    props: { providerType: ProviderType.PLAYER },
  },
  plugins: {
    component: markRaw(ProvidersStep),
    props: { providerType: ProviderType.PLUGIN },
  },
  core_settings: { component: markRaw(CoreSettingsStep) },
  invite_members: { component: markRaw(InviteMembersStep) },
  finish: { component: markRaw(FinishStep), props: { stepId: "finish" } },
  welcome: { component: markRaw(WelcomeStep) },
  your_players: { component: markRaw(YourPlayersStep) },
  your_music: { component: markRaw(YourMusicStep) },
  own_sources: { component: markRaw(OwnSourcesStep) },
  tour: { component: markRaw(TourStep) },
  // the same summary, told as the end of the welcome instead of the setup
  all_set: { component: markRaw(FinishStep), props: { stepId: "all_set" } },
};

// The step being shown is page state: the wizard never moves by itself while
// providers arrive, only when the user (or the step it opens on) says so. It
// stays unresolved until the onboarding data lands, so the wizard never opens
// on a step that turns out to be done already.
const currentId = ref<OnboardingStepId | null>(null);
const stepHeading = ref<HTMLHeadingElement | null>(null);
const finishing = ref(false);
// whether this open's data is in and its opening step is settled
const ready = ref(false);
// a step can take a moment to let go of the user — the server settings save on
// their way out — and a second click must not set off from where the first one
// has already arrived
const moving = ref(false);

/** What a step exposes to the wizard, which every step may leave to default. */
interface StepInstance {
  beforeLeave?: () => Promise<boolean>;
  // a choice step raises this while its answer is on its way to the server
  busy?: boolean;
}

const stepRef = ref<StepInstance | null>(null);

// The step on screen gets a say before the wizard moves off it, so a step with
// something to save is not walked away from. A step that has nothing to hold on
// to exposes nothing and the wizard simply moves on.
const leaveStep = async () => (await stepRef.value?.beforeLeave?.()) ?? true;

// whether the step on screen is saving a choice of its own; the wizard's Next
// stands aside while it is, so a choice and a Next cannot both move on
const stepBusy = computed(() => stepRef.value?.busy ?? false);

const currentIndex = computed(() =>
  steps.value.findIndex((step) => step.id === currentId.value),
);
const currentStep = computed(() => steps.value[currentIndex.value]);
const canGoBack = computed(() => currentIndex.value > 0);
const stepNumber = computed(() => Math.max(currentIndex.value + 1, 1));
// the progress list, done state and all, in the same order the wizard walks
const progressSteps = computed(() =>
  steps.value.map((step) => ({ id: step.id, done: step.isDone(ctx.value) })),
);
const stepTitle = computed(() =>
  currentId.value ? $t(`onboarding.steps.${currentId.value}.title`) : "",
);
// the eyebrow above the step says which wizard this is: the server's setup, or
// the welcome someone who lives here is being given
const trackTitleKey = computed(() =>
  ctx.value.isMember ? "onboarding.welcome_title" : "onboarding.title",
);

const stepView = computed(() => {
  const id = currentId.value;
  if (!id) return null;
  const view = STEP_VIEWS[id];
  return {
    component: view.component,
    // the summary is the only step that finishes the wizard, so it is the only
    // one that has to know a finish is on its way out
    props:
      currentStep.value?.kind === "summary"
        ? { ...view.props, busy: finishing.value }
        : view.props,
  };
});

// The summary owns its own finish button, so the footer is for the steps only.
const showForwardAction = computed(
  () => currentStep.value != null && currentStep.value.kind !== "summary",
);
// a step that does not hold the wizard up is skipped rather than moved on from,
// whether it is optional by nature or one the answers deferred
const forwardLabel = computed(() => {
  const step = currentStep.value;
  if ((step?.optional || step?.deferred) && !step.isDone(ctx.value))
    return $t("onboarding.skip");
  return $t("onboarding.next");
});

const goTo = function (id: OnboardingStepId) {
  currentId.value = id;
};

// Back and the progress list both return to a step already behind the current
// one, so they share the guard that lets the step on screen save first.
const goToGuarded = async function (id: OnboardingStepId) {
  if (moving.value) return;
  moving.value = true;
  try {
    if (!(await leaveStep())) return;
    goTo(id);
  } finally {
    moving.value = false;
  }
};

const back = async function () {
  const previous = steps.value[currentIndex.value - 1];
  if (previous) await goToGuarded(previous.id);
};

const jumpTo = async function (id: OnboardingStepId) {
  await goToGuarded(id);
};

// Next moves one step along the visible order and no further: a step that is
// already done is walked through, not skipped over, so the running order the
// user sees is the order they move through. A question walked past answers
// itself with its recommended option, which the step does on its way out.
const next = async function () {
  // a choice being saved on the step owns the move: standing aside keeps Next
  // from advancing a second step or waving a default over the answer
  if (moving.value || stepBusy.value) return;
  moving.value = true;
  try {
    if (!(await leaveStep())) return;
    const following = steps.value[currentIndex.value + 1];
    if (following) goTo(following.id);
  } finally {
    moving.value = false;
  }
};

const finishOnboarding = async function () {
  if (finishing.value) return;
  finishing.value = true;
  try {
    await finish();
  } finally {
    finishing.value = false;
  }
};

const focusStepHeading = async function () {
  await nextTick();
  stepHeading.value?.focus();
};

// The setup decides everything off the provider configurations and the users,
// so the wizard asks for them itself as it opens; the step it opens on is
// settled from that answer rather than from whatever a previous open left
// behind. The member track reads the providers and players that are running,
// neither of which it has to ask for — bar a member who can own sources, whose
// own-sources step needs the provider configs to tell which sources they own.
onMounted(async () => {
  if (!ctx.value.isMember) await loadOnboardingData();
  else if (ctx.value.canOwnSources) await loadProviderConfigs();
  currentId.value = firstStep(ctx.value, requestedStep.value);
  ready.value = true;
});

// Focus lands on the heading as the wizard opens and follows the step from
// there, so the keyboard stays inside the wizard as it moves.
watch(currentId, focusStepHeading);

// Leaving the welcome is what counts as having been welcomed, whether the
// member answered the question, walked past it or closed the modal: nobody is
// welcomed into the same app twice. Finishing writes this itself, and the
// marker is only ever written once, so the two never collide.
onBeforeUnmount(() => {
  if (ctx.value.isMember) void markWelcomed();
});
</script>
