<template>
  <div
    class="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-5 p-4 sm:p-5"
    data-testid="onboarding-view"
  >
    <header class="flex flex-col gap-3">
      <p class="text-muted-foreground text-sm">{{ $t("onboarding.title") }}</p>
      <div class="flex min-w-0 items-center gap-2">
        <Button
          v-if="canGoBack"
          variant="ghost"
          size="icon"
          class="-ml-2 shrink-0"
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
      :key="currentId"
      v-bind="stepView.props"
      @advance="next"
      @navigate="goTo"
      @finish="finishOnboarding"
    />

    <footer v-if="showForwardAction" class="flex items-center gap-2">
      <Button data-testid="onboarding-next" @click="next">
        {{ forwardLabel }}
      </Button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import FinishStep from "@/components/onboarding/steps/FinishStep.vue";
import IntentStep from "@/components/onboarding/steps/IntentStep.vue";
import ProvidersStep from "@/components/onboarding/steps/ProvidersStep.vue";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/composables/useOnboarding";
import { firstStep, type OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ArrowLeft } from "@lucide/vue";
import {
  computed,
  markRaw,
  nextTick,
  onMounted,
  ref,
  watch,
  type Component,
} from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const { ctx, steps, finish } = useOnboarding();

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
  finish: { component: markRaw(FinishStep) },
};

const requestedId = computed(() => {
  const step = route.query.step;
  return typeof step === "string" ? step : undefined;
});

// The step being shown is page state: the wizard never moves by itself while
// providers arrive, only when the user (or a deep link) says so.
const currentId = ref<OnboardingStepId>(
  firstStep(ctx.value, requestedId.value),
);
const stepHeading = ref<HTMLHeadingElement | null>(null);
const finishing = ref(false);

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
  $t(`onboarding.steps.${currentId.value}.title`),
);

const stepView = computed(() => {
  const view = STEP_VIEWS[currentId.value];
  return {
    component: view.component,
    props:
      currentId.value === "finish"
        ? { ...view.props, busy: finishing.value }
        : view.props,
  };
});

// The summary owns its own finish button, so the footer is for the steps only.
const showForwardAction = computed(
  () => currentStep.value != null && currentStep.value.kind !== "summary",
);
const forwardLabel = computed(() => {
  const step = currentStep.value;
  if (step?.optional && !step.isDone(ctx.value)) return $t("onboarding.skip");
  return $t("onboarding.next");
});

const goTo = function (id: OnboardingStepId) {
  currentId.value = id;
};

const back = function () {
  const previous = steps.value[currentIndex.value - 1];
  if (previous) goTo(previous.id);
};

const next = function () {
  const following = steps.value[currentIndex.value + 1];
  if (following) goTo(following.id);
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
// route) decides the step; anything that does not apply falls back.
watch(requestedId, (id) => {
  const resolved = firstStep(ctx.value, id);
  if (resolved !== currentId.value) currentId.value = resolved;
});

// Keep the query pointing at the step on screen, so a reload stays put.
watch(
  currentId,
  (id) => {
    if (route.query.step === id) return;
    router.replace({ query: { ...route.query, step: id } });
  },
  { immediate: true },
);

const focusStepHeading = async function () {
  await nextTick();
  stepHeading.value?.focus();
};

// Focus follows the step, and lands on the heading when the wizard opens too,
// so arriving from the sidebar checklist puts the keyboard inside the wizard.
onMounted(focusStepHeading);
watch(currentId, focusStepHeading);
</script>
