<template>
  <div
    class="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 p-4 sm:p-5"
    data-testid="onboarding-view"
  >
    <header class="flex flex-col gap-3">
      <p class="text-muted-foreground text-sm">{{ $t(trackTitleKey) }}</p>
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
      <div v-if="currentStep" class="flex items-center gap-3">
        <Progress :model-value="progress" class="max-w-xs" />
        <span class="text-muted-foreground shrink-0 text-sm">
          {{
            $t("onboarding.step_counter", {
              current: stepNumber,
              total: steps.length,
            })
          }}
        </span>
      </div>
    </header>

    <component
      :is="stepView.component"
      v-if="stepView"
      :key="currentId"
      ref="stepRef"
      v-bind="stepView.props"
      @advance="next"
      @navigate="goTo"
      @finish="finishOnboarding"
    />

    <footer v-if="showForwardAction" class="flex items-center gap-2">
      <Button :disabled="moving" data-testid="onboarding-next" @click="next">
        {{ forwardLabel }}
      </Button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import FinishStep from "@/components/onboarding/steps/FinishStep.vue";
import IntentStep from "@/components/onboarding/steps/IntentStep.vue";
import InviteMembersStep from "@/components/onboarding/steps/InviteMembersStep.vue";
import ProvidersStep from "@/components/onboarding/steps/ProvidersStep.vue";
import TourStep from "@/components/onboarding/steps/TourStep.vue";
import WelcomeStep from "@/components/onboarding/steps/WelcomeStep.vue";
import WhatsHereStep from "@/components/onboarding/steps/WhatsHereStep.vue";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/composables/useOnboarding";
import { firstStep, isTodo, type OnboardingStepId } from "@/helpers/onboarding";
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
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const { ctx, steps, loadOnboardingData, markWelcomed, setIntent, finish } =
  useOnboarding();

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
  whats_here: { component: markRaw(WhatsHereStep) },
  tour: { component: markRaw(TourStep) },
  // the same summary, told as the end of the welcome instead of the setup
  all_set: { component: markRaw(FinishStep), props: { stepId: "all_set" } },
};

const requestedId = computed(() => {
  const step = route.query.step;
  return typeof step === "string" ? step : undefined;
});

// The step being shown is page state: the wizard never moves by itself while
// providers arrive, only when the user (or a deep link) says so. It stays
// unresolved until the onboarding data lands, so the wizard never opens on a
// step that turns out to be done already.
const currentId = ref<OnboardingStepId | null>(null);
const stepHeading = ref<HTMLHeadingElement | null>(null);
const finishing = ref(false);
// whether this visit's own answer is in: the onboarding state is shared with
// the sidebar and outlives the page, so what it holds on arrival is what some
// earlier visit was told
const ready = ref(false);
// a step can take a moment to let go of the user — the server settings save on
// their way out — and a second click must not set off from where the first one
// has already arrived
const moving = ref(false);

/** What a step exposes to the wizard, which every step may leave to default. */
interface StepInstance {
  beforeLeave?: () => Promise<boolean>;
}

const stepRef = ref<StepInstance | null>(null);

// The step on screen gets a say before the wizard moves off it, so a step with
// something to save is not walked away from. A step that has nothing to hold on
// to exposes nothing and the wizard simply moves on.
const leaveStep = async () => (await stepRef.value?.beforeLeave?.()) ?? true;

const currentIndex = computed(() =>
  steps.value.findIndex((step) => step.id === currentId.value),
);
const currentStep = computed(() => steps.value[currentIndex.value]);
const canGoBack = computed(() => currentIndex.value > 0);
const stepNumber = computed(() => Math.max(currentIndex.value + 1, 1));
const progress = computed(() =>
  steps.value.length > 0 ? (stepNumber.value / steps.value.length) * 100 : 0,
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
// a step that does not hold the wizard up is skipped rather than finished,
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

const back = async function () {
  if (moving.value) return;
  moving.value = true;
  try {
    if (!(await leaveStep())) return;
    const previous = steps.value[currentIndex.value - 1];
    if (previous) goTo(previous.id);
  } finally {
    moving.value = false;
  }
};

// Forward skips whatever is already set up, bar the steps that are nothing to
// do: a review is walked past rather than skipped, and the summary is where the
// wizard ends up once nothing is left. Back stays on the running order, so a
// step that is done can still be revisited. Moving on from the question
// unanswered is an answer of its own: the music hub is what the wizard then
// runs as, instead of leaving the question to be asked again.
const next = async function () {
  if (moving.value) return;
  moving.value = true;
  try {
    if (!(await leaveStep())) return;
    if (
      currentStep.value?.id === "intent" &&
      ctx.value.answers.intent == null
    ) {
      await setIntent("music_hub");
    }
    const following = steps.value
      .slice(currentIndex.value + 1)
      .find((step) => !isTodo(step) || !step.isDone(ctx.value));
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

// A deep link (or the getting-started checklist, which pushes onto this same
// route) decides the step; anything that does not apply falls back. This also
// settles the step the wizard opens on, as soon as the data is in.
watch(
  [ready, requestedId],
  ([loaded, id]) => {
    if (!loaded) return;
    const resolved = firstStep(ctx.value, id);
    if (resolved !== currentId.value) currentId.value = resolved;
  },
  { immediate: true },
);

// Keep the query pointing at the step on screen, so a reload stays put.
watch(
  currentId,
  (id) => {
    if (id == null || route.query.step === id) return;
    router.replace({ query: { ...route.query, step: id } });
  },
  { immediate: true },
);

const focusStepHeading = async function () {
  await nextTick();
  stepHeading.value?.focus();
};

// The setup decides everything off the provider configurations and the users,
// so the wizard asks for them itself; a remount is worth the one call for a
// fresh answer, and the step this visit opens on is settled from that answer
// rather than from whatever an earlier one left behind. Focus lands on the
// heading as the wizard opens, so arriving from the sidebar checklist puts the
// keyboard inside it, and follows the step from there.
onMounted(async () => {
  focusStepHeading();
  // the member track reads the providers and players that are running, neither
  // of which it has to ask for, so the welcome waits for nothing
  if (!ctx.value.isMember) await loadOnboardingData();
  ready.value = true;
});
watch(currentId, focusStepHeading);

// Leaving the welcome is what counts as having been welcomed, whether the
// member answered the question, walked past it or went somewhere else in the
// app: nobody is welcomed into the same app twice. Finishing writes this
// itself, and the marker is only ever written once, so the two never collide.
onBeforeUnmount(() => {
  if (ctx.value.isMember) void markWelcomed();
});
</script>
