<template>
  <div
    class="flex min-h-0 w-full flex-1 flex-col"
    data-testid="onboarding-wizard"
  >
    <!-- Back and the progress share the row with the dialog's close button,
         which the right padding keeps clear; the row is always there, so the
         step under it never moves up when there is no Back -->
    <header class="flex h-8 shrink-0 items-center gap-3 pr-8">
      <Button
        v-if="ready && canGoBack"
        variant="ghost"
        size="icon"
        class="-ml-2 size-8 shrink-0"
        :disabled="moving || stepBusy"
        :aria-label="$t('back')"
        :title="$t('back')"
        data-testid="onboarding-back"
        @click="back"
      >
        <ArrowLeft class="size-4" />
      </Button>
      <OnboardingProgress
        v-if="ready && progressIndex >= 0"
        class="min-w-0 flex-1"
        :class="{ 'ml-6': !canGoBack }"
        :steps="progressSteps"
        :current="progressIndex"
        @navigate="jumpTo"
      />
      <span
        v-if="ready && progressIndex >= 0"
        class="text-muted-foreground shrink-0 text-xs tabular-nums max-sm:sr-only"
        data-testid="onboarding-step-counter"
      >
        {{
          $t("onboarding.step_counter", {
            current: progressIndex + 1,
            total: progressSteps.length,
          })
        }}
      </span>
    </header>

    <div
      v-if="!ready"
      class="flex min-h-40 flex-1 items-center justify-center"
      data-testid="onboarding-loading"
    >
      <Spinner class="size-6" />
    </div>

    <template v-else-if="stepView">
      <!-- the header stays put on every step and only the step under it
           scrolls, keyed so each step starts at the top -->
      <OnboardingStepHeader
        ref="stepHeader"
        class="mt-10 shrink-0"
        :icon="stepView.icon"
        :title="stepTitle"
        :lead="stepLead"
        :set-up="stepSetUp"
      />
      <ScrollFade
        :key="currentId ?? undefined"
        class="-mx-1 mt-5 px-1 pt-1 pb-1"
      >
        <component
          :is="stepView.component"
          ref="stepRef"
          v-bind="stepView.props"
          @advance="next"
          @navigate="goTo"
          @finish="finishOnboarding()"
        />
      </ScrollFade>
    </template>

    <!-- one main button, always the last; on a phone the buttons stack with
         the main one on top -->
    <footer
      v-if="ready && showForwardAction"
      class="mt-4 flex shrink-0 flex-col-reverse gap-1 sm:flex-row sm:justify-end sm:gap-2"
    >
      <template v-if="primaryAction">
        <Button
          variant="ghost"
          class="w-full sm:w-auto"
          :disabled="moving || stepBusy"
          data-testid="onboarding-skip"
          @click="next"
        >
          {{ $t("onboarding.skip") }}
        </Button>
        <Button
          class="w-full sm:w-auto"
          :loading="primaryAction.busy"
          data-testid="onboarding-primary-action"
          @click="primaryAction.run()"
        >
          <component :is="primaryAction.icon" class="size-4" />
          {{ $t(primaryAction.labelKey) }}
        </Button>
      </template>
      <template v-else-if="isSummary">
        <Button
          v-if="offerTour"
          variant="ghost"
          class="w-full sm:w-auto"
          :disabled="finishing"
          data-testid="onboarding-tour"
          @click="finishOnboarding(true)"
        >
          <Route class="size-4" aria-hidden="true" />
          {{ $t("tour.start") }}
        </Button>
        <Button
          class="w-full sm:w-auto"
          :disabled="finishing"
          data-testid="onboarding-finish"
          @click="finishOnboarding()"
        >
          {{ $t("onboarding.finish") }}
        </Button>
      </template>
      <Button
        v-else-if="forwardForm"
        type="submit"
        :form="forwardForm.id"
        class="w-full sm:w-auto"
        :disabled="moving"
        :loading="stepBusy"
        data-testid="onboarding-next"
      >
        {{ forwardLabel }}
      </Button>
      <Button
        v-else
        class="w-full sm:w-auto"
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
import OnboardingStepHeader from "@/components/onboarding/OnboardingStepHeader.vue";
import ScrollFade from "@/components/onboarding/ScrollFade.vue";
import AccountStep from "@/components/onboarding/steps/AccountStep.vue";
import AIStep from "@/components/onboarding/steps/AIStep.vue";
import CoreSettingsStep from "@/components/onboarding/steps/CoreSettingsStep.vue";
import FinishStep from "@/components/onboarding/steps/FinishStep.vue";
import GetStartedStep from "@/components/onboarding/steps/GetStartedStep.vue";
import HomeAssistantStep from "@/components/onboarding/steps/HomeAssistantStep.vue";
import IntentStep from "@/components/onboarding/steps/IntentStep.vue";
import InviteMembersStep from "@/components/onboarding/steps/InviteMembersStep.vue";
import OwnSourcesStep from "@/components/onboarding/steps/OwnSourcesStep.vue";
import PlayersStep from "@/components/onboarding/steps/PlayersStep.vue";
import ProvidersStep from "@/components/onboarding/steps/ProvidersStep.vue";
import WelcomeStep from "@/components/onboarding/steps/WelcomeStep.vue";
import YourMusicStep from "@/components/onboarding/steps/YourMusicStep.vue";
import YourPlayersStep from "@/components/onboarding/steps/YourPlayersStep.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOnboarding } from "@/composables/useOnboarding";
import { useTour } from "@/composables/useTour";
import {
  firstStep,
  stepLeadKey,
  stepTitleKey,
  type OnboardingStepId,
  type StepForwardForm,
  type StepLeaveOptions,
  type StepPrimaryAction,
} from "@/helpers/onboarding";
import { userDisplayName } from "@/helpers/provider_access";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  Armchair,
  ArrowLeft,
  Compass,
  Globe,
  Headphones,
  House,
  Library,
  Music,
  PartyPopper,
  Route,
  Smartphone,
  Sparkles,
  Speaker,
  UserRound,
  Users,
} from "@lucide/vue";
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
  followPlayers,
  markWelcomed,
  setStepGuard,
  finish,
} = useOnboarding();
const { start: startTour } = useTour();

// each step's view, and the icon its header shows; the welcome of a fresh
// server shows the app's own logo
const STEP_VIEWS: Record<
  OnboardingStepId,
  {
    component: Component;
    icon: Component | "logo";
    props?: Record<string, unknown>;
  }
> = {
  get_started: { component: markRaw(GetStartedStep), icon: "logo" },
  account: { component: markRaw(AccountStep), icon: markRaw(UserRound) },
  intent: { component: markRaw(IntentStep), icon: markRaw(Compass) },
  music_sources: {
    component: markRaw(ProvidersStep),
    icon: markRaw(Music),
    props: { providerType: ProviderType.MUSIC },
  },
  players: { component: markRaw(PlayersStep), icon: markRaw(Speaker) },
  plugins: {
    component: markRaw(ProvidersStep),
    icon: markRaw(Smartphone),
    props: { providerType: ProviderType.PLUGIN },
  },
  core_settings: {
    component: markRaw(CoreSettingsStep),
    icon: markRaw(Globe),
  },
  home_assistant: {
    component: markRaw(HomeAssistantStep),
    icon: markRaw(House),
  },
  ai: { component: markRaw(AIStep), icon: markRaw(Sparkles) },
  invite_members: {
    component: markRaw(InviteMembersStep),
    icon: markRaw(Users),
  },
  finish: {
    component: markRaw(FinishStep),
    icon: markRaw(PartyPopper),
    props: { stepId: "finish" },
  },
  welcome: { component: markRaw(WelcomeStep), icon: markRaw(Armchair) },
  your_players: { component: markRaw(YourPlayersStep), icon: markRaw(Speaker) },
  your_music: { component: markRaw(YourMusicStep), icon: markRaw(Library) },
  own_sources: {
    component: markRaw(OwnSourcesStep),
    icon: markRaw(Headphones),
  },
  // the same summary, told as the end of the welcome instead of the setup
  all_set: {
    component: markRaw(FinishStep),
    icon: markRaw(PartyPopper),
    props: { stepId: "all_set" },
  },
};

// Do not announce a setup length before the user confirms their choice.
const PRE_SETUP_STEPS: ReadonlySet<OnboardingStepId> = new Set([
  "get_started",
  "account",
  "intent",
]);

// the steps that move on under a label of their own instead of Next
const FORWARD_LABEL_KEYS: Partial<Record<OnboardingStepId, string>> = {
  get_started: "onboarding.steps.get_started.start",
};

// The step being shown is page state: the wizard never moves by itself while
// providers arrive, only when the user (or the step it opens on) says so. It
// stays unresolved until the onboarding data lands, so the wizard never opens
// on a step that turns out to be done already.
const currentId = ref<OnboardingStepId | null>(null);
const stepHeader = ref<InstanceType<typeof OnboardingStepHeader> | null>(null);
const finishing = ref(false);
// whether this open's data is in and its opening step is settled
const ready = ref(false);
// a step can take a moment to let go of the user — an answer saves on its way
// out — and a second click must not set off from where the first one
// has already arrived
const moving = ref(false);
// what stops the players being followed once the wizard is gone
let stopFollowingPlayers: (() => void) | undefined;

/** What a step exposes to the wizard, which every step may leave to default. */
interface StepInstance {
  beforeLeave?: (options?: StepLeaveOptions) => Promise<boolean>;
  // a choice step raises this while its answer is on its way to the server
  busy?: boolean;
  // a step whose way on is its own, which the wizard's forward button stands
  // down for
  ownsForwardAction?: boolean;
  // a step with a form of its own, which the wizard's forward button submits
  forwardForm?: StepForwardForm;
  // a step's own way forward while it is not set up, which the footer shows
  // as its main button, with a skip beside it
  primaryAction?: StepPrimaryAction;
}

const stepRef = ref<StepInstance | null>(null);

// The step on screen gets a say before the wizard moves off it, so a step with
// something to save is not walked away from. A step that has nothing to hold on
// to exposes nothing and the wizard simply moves on.
const leaveStep = async (options?: StepLeaveOptions) =>
  (await stepRef.value?.beforeLeave?.(options)) ?? true;

// Next and Back wait for the selected answer to reach the server.
const stepBusy = computed(() => stepRef.value?.busy ?? false);
const forwardForm = computed(() => stepRef.value?.forwardForm);
const primaryAction = computed(() => stepRef.value?.primaryAction);

// steps the user has been past, so a review stays ticked after going back
const passedSteps = ref(new Set<OnboardingStepId>());

const currentIndex = computed(() =>
  steps.value.findIndex((step) => step.id === currentId.value),
);
const currentStep = computed(() => steps.value[currentIndex.value]);
const previousStep = computed(() => steps.value[currentIndex.value - 1]);
// a step done for good is behind the user, and so is everything before it
const canGoBack = computed(() => {
  const previous = previousStep.value;
  return previous != null && !(previous.oneWay && previous.isDone(ctx.value));
});
// the progress list, done state and all, in the same order the wizard walks
// a review has nothing to tick off, so one the user has been past counts as
// looked over
const progressSteps = computed(() =>
  steps.value
    .filter((step) => !PRE_SETUP_STEPS.has(step.id))
    .map((step) => ({
      id: step.id,
      titleKey: stepTitleKey(step.id, ctx.value.answers),
      done:
        step.isDone(ctx.value) ||
        (step.kind === "review" && passedSteps.value.has(step.id)),
    })),
);
// Navigation includes the introductory screens; numbered progress does not.
const progressIndex = computed(() =>
  progressSteps.value.findIndex((step) => step.id === currentId.value),
);
const stepTitle = computed(() =>
  currentId.value ? $t(stepTitleKey(currentId.value, ctx.value.answers)) : "",
);
// the welcome greets the member by name; every other lead ignores the name
const stepLead = computed(() =>
  currentId.value
    ? $t(stepLeadKey(currentId.value, ctx.value), {
        name: store.currentUser ? userDisplayName(store.currentUser) : "",
      })
    : "",
);
// a step that is set up wears a tick on its icon
const stepSetUp = computed(
  () =>
    currentStep.value?.kind === "step" &&
    currentStep.value.id !== "get_started" &&
    currentStep.value.isDone(ctx.value),
);

const isSummary = computed(() => currentStep.value?.kind === "summary");
const offerTour = computed(
  () =>
    isSummary.value &&
    (ctx.value.isMember || ctx.value.answers.intent !== "phone_apps"),
);

const stepView = computed(() => {
  const id = currentId.value;
  if (!id) return null;
  const view = STEP_VIEWS[id];
  return {
    component: view.component,
    icon: view.icon,
    // the summary is the only step that finishes the wizard, so it is the only
    // one that has to know a finish is on its way out
    props: isSummary.value
      ? { ...view.props, busy: finishing.value }
      : view.props,
  };
});

// A step can hold its own way on, so the footer is for the other steps; on the
// summary it holds Finish.
const showForwardAction = computed(
  () => currentStep.value != null && !stepRef.value?.ownsForwardAction,
);
const forwardLabel = computed(() => {
  if (forwardForm.value) return $t(forwardForm.value.labelKey);
  return $t(
    (currentId.value && FORWARD_LABEL_KEYS[currentId.value]) ??
      "onboarding.next",
  );
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
    if (!(await leaveStep({ back: true }))) return;
    goTo(id);
  } finally {
    moving.value = false;
  }
};

const back = async function () {
  if (canGoBack.value) await goToGuarded(previousStep.value.id);
};

const jumpTo = async function (id: OnboardingStepId) {
  await goToGuarded(id);
};

// Next moves one step along the visible order and no further: a step that is
// already done is walked through, not skipped over, so the running order the
// user sees is the order they move through.
const next = async function () {
  // a choice being saved must land before Next can leave the question
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

// The tour is only given once onboarding has let go: a finish that did not
// land keeps the wizard up, and the tour waits with it.
const finishOnboarding = async function (tour = false) {
  if (finishing.value) return;
  finishing.value = true;
  try {
    if ((await finish()) && tour) startTour();
  } finally {
    finishing.value = false;
  }
};

const focusStepHeading = async function () {
  await nextTick();
  stepHeader.value?.focus();
};

// The setup decides everything off the provider configurations, the players
// and the users, so the wizard asks for them itself as it opens; the step it
// opens on is settled from that answer rather than from whatever a previous
// open left behind. The players keep turning up while the setup runs, so they
// are followed from before the load until the wizard is gone.
const loadAdminTrack = async () => {
  stopFollowingPlayers?.();
  stopFollowingPlayers = followPlayers();
  await loadOnboardingData();
};

// The member track reads the providers and players that are running, neither
// of which it has to ask for — bar a member who can own sources, whose
// own-sources step needs the provider configs to tell which sources they own.
onMounted(async () => {
  if (!ctx.value.isMember) await loadAdminTrack();
  else if (ctx.value.canOwnSources) await loadProviderConfigs();
  currentId.value = firstStep(ctx.value, requestedStep.value);
  ready.value = true;
});

// On a fresh server the wizard opens before there is an admin to load the
// setup for: the server only tells one what is configured. The account step
// makes them, and the load runs again once they are in.
watch(
  () => ctx.value.isAdmin,
  async (isAdmin, wasAdmin) => {
    if (isAdmin && !wasAdmin && ctx.value.firstRun) await loadAdminTrack();
  },
);

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

// Leaving the welcome is what counts as having been welcomed, whether the
// member answered the question, walked past it or closed the modal: nobody is
// welcomed into the same app twice. Finishing writes this itself, and the
// marker is only ever written once, so the two never collide.
onBeforeUnmount(() => {
  removeStepGuard();
  stopFollowingPlayers?.();
  if (ctx.value.isMember) void markWelcomed();
});
</script>
