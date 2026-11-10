<template>
  <div
    class="flex min-h-0 w-full flex-1 flex-col gap-5"
    data-testid="onboarding-wizard"
  >
    <header class="flex shrink-0 flex-col gap-3">
      <p class="text-muted-foreground text-sm">{{ $t("onboarding.title") }}</p>
      <template v-if="ready && currentStep">
        <!-- as tall as the back button, so the title stays put without it -->
        <div class="flex min-h-9 min-w-0 items-center gap-2">
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
            class="text-xl font-semibold outline-none"
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
          <span
            class="text-muted-foreground sr-only shrink-0 text-sm sm:not-sr-only"
          >
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

    <!-- only the step scrolls; keyed so each step starts at the top -->
    <ScrollFade :key="currentId ?? undefined" class="-mx-1 flex flex-col px-1">
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
        ref="stepRef"
        v-bind="stepView.props"
        @advance="next"
        @navigate="goTo"
      />
    </ScrollFade>

    <footer
      v-if="ready && showForwardAction"
      class="flex shrink-0 items-center justify-end gap-2"
    >
      <Button
        v-if="isSummary"
        class="w-full sm:w-auto"
        :disabled="finishing"
        data-testid="onboarding-finish"
        @click="finishOnboarding()"
      >
        {{ $t("onboarding.finish") }}
      </Button>
      <Button
        v-else
        class="w-full sm:w-auto"
        :variant="skipping ? 'secondary' : 'default'"
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
import ScrollFade from "@/components/onboarding/ScrollFade.vue";
import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import FinishStep from "@/components/onboarding/steps/FinishStep.vue";
import IntentStep from "@/components/onboarding/steps/IntentStep.vue";
import PlayersStep from "@/components/onboarding/steps/PlayersStep.vue";
import ProvidersStep from "@/components/onboarding/steps/ProvidersStep.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOnboarding } from "@/composables/useOnboarding";
import {
  firstStep,
  type OnboardingStepId,
  type StepLeaveOptions,
} from "@/helpers/onboarding";
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
  followPlayers,
  setStepGuard,
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
  players: { component: markRaw(PlayersStep) },
  plugins: {
    component: markRaw(ProvidersStep),
    props: { providerType: ProviderType.PLUGIN },
  },
  core_settings: { component: markRaw(CoreSettingsStep) },
  finish: { component: markRaw(FinishStep) },
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
// what stops the players being followed once the wizard is gone
let stopFollowingPlayers: (() => void) | undefined;

/** What a step exposes to the wizard, which every step may leave to default. */
interface StepInstance {
  beforeLeave?: (options?: StepLeaveOptions) => Promise<boolean>;
  // a choice step raises this while its answer is on its way to the server
  busy?: boolean;
  // a step with a submit of its own, which the wizard's Next stands down for
  ownsForwardAction?: boolean;
}

const stepRef = ref<StepInstance | null>(null);

// The step on screen gets a say before the wizard moves off it, so a step with
// something to save is not walked away from. A step that has nothing to hold on
// to exposes nothing and the wizard simply moves on.
const leaveStep = async (options?: StepLeaveOptions) =>
  (await stepRef.value?.beforeLeave?.(options)) ?? true;

// whether the step on screen is saving a choice of its own; the wizard's Next
// stands aside while it is, so a choice and a Next cannot both move on
const stepBusy = computed(() => stepRef.value?.busy ?? false);

// steps the user has been past, so a review stays ticked after going back
const passedSteps = ref(new Set<OnboardingStepId>());

const currentIndex = computed(() =>
  steps.value.findIndex((step) => step.id === currentId.value),
);
const currentStep = computed(() => steps.value[currentIndex.value]);
const canGoBack = computed(() => currentIndex.value > 0);
const stepNumber = computed(() => Math.max(currentIndex.value + 1, 1));
// the progress list, done state and all, in the same order the wizard walks
// a review has nothing to tick off, so one the user has been past counts as
// looked over
const progressSteps = computed(() =>
  steps.value.map((step) => ({
    id: step.id,
    done:
      step.isDone(ctx.value) ||
      (step.kind === "review" && passedSteps.value.has(step.id)),
  })),
);
const stepTitle = computed(() =>
  currentId.value ? $t(`onboarding.steps.${currentId.value}.title`) : "",
);
const isSummary = computed(() => currentStep.value?.kind === "summary");

const stepView = computed(() =>
  currentId.value ? STEP_VIEWS[currentId.value] : null,
);

// A form step owns its own submit, so the footer is for the other steps; on
// the summary it holds Finish.
const showForwardAction = computed(
  () => currentStep.value != null && !stepRef.value?.ownsForwardAction,
);
// a step that does not hold the wizard up is skipped rather than moved on from,
// whether it is optional by nature or one the answers deferred
const skipping = computed(() => {
  const step = currentStep.value;
  return !!(step?.optional || step?.deferred) && !step.isDone(ctx.value);
});
const forwardLabel = computed(() =>
  skipping.value ? $t("onboarding.skip") : $t("onboarding.next"),
);

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

// The setup decides everything off the provider configurations and the
// players, so the wizard asks for them itself as it opens; the step it opens on
// is settled from that answer rather than from whatever a previous open left
// behind. The players keep turning up while the setup runs, so they are
// followed from before the load until the wizard is gone.
onMounted(async () => {
  stopFollowingPlayers = followPlayers();
  await loadOnboardingData();
  currentId.value = firstStep(ctx.value, requestedStep.value);
  ready.value = true;
});

// Focus lands on the heading as the wizard opens and follows the step from
// there, so the keyboard stays inside the wizard as it moves.
watch(currentId, focusStepHeading);

// the step it is on is where a paused setup opens again, and pausing lets that
// step save first, as moving on does
watch(currentId, (id) => {
  if (id) requestedStep.value = id;
});
const removeStepGuard = setStepGuard(() => leaveStep({ pausing: true }));

watch(currentId, (_, previous) => {
  for (const step of steps.value.slice(0, currentIndex.value)) {
    passedSteps.value.add(step.id);
  }
  if (previous) passedSteps.value.add(previous);
});

onBeforeUnmount(() => {
  removeStepGuard();
  stopFollowingPlayers?.();
});
</script>
