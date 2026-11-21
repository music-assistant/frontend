<template>
  <section class="flex flex-col gap-3">
    <!-- the cards answer one question, and the step's lead is what asks it -->
    <ChoiceCards
      :options="options"
      :selected="shown"
      :busy="busy"
      :labelled-by="STEP_LEAD_ID"
      test-id-prefix="onboarding-experience"
      @select="select"
    />

    <p class="text-muted-foreground text-center text-xs text-pretty">
      {{ $t("onboarding.steps.welcome.defaults_hint") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import ChoiceCards, {
  type ChoiceCardOption,
} from "@/components/onboarding/ChoiceCards.vue";
import { useOnboarding } from "@/composables/useOnboarding";
import {
  experienceOf,
  STEP_LEAD_ID,
  type OnboardingExperience,
  type OnboardingStepId,
} from "@/helpers/onboarding";
import { $t } from "@/plugins/i18n";
import { Play, SlidersHorizontal } from "@lucide/vue";
import { computed, markRaw, ref } from "vue";
import { toast } from "vue-sonner";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { expertMode, setExpertMode } = useOnboarding();

const options: ChoiceCardOption<OnboardingExperience>[] = [
  {
    value: "standard",
    icon: markRaw(Play),
    labelKey: "onboarding.steps.welcome.standard.label",
    descriptionKey: "onboarding.steps.welcome.standard.description",
    recommended: true,
  },
  {
    value: "expert",
    icon: markRaw(SlidersHorizontal),
    labelKey: "onboarding.steps.welcome.expert.label",
    descriptionKey: "onboarding.steps.welcome.expert.description",
  },
];

// the answer the account holds, as the cards know it
const stored = computed(() =>
  expertMode.value == null ? undefined : experienceOf(expertMode.value),
);

// the answer on its way to the server; the cards stay inert until it lands
const saving = ref<OnboardingExperience | null>(null);
const busy = computed(() => saving.value != null);
// that save, which the wizard waits for before it moves off this step
let pendingSave: Promise<boolean> | null = null;

// the card shown as chosen: the answer being saved, else the one on the account
const shown = computed(() => saving.value ?? stored.value);

const save = async function (value: OnboardingExperience): Promise<boolean> {
  saving.value = value;
  try {
    const saved = await setExpertMode(value === "expert");
    // an answer that did not reach the server is not an answer: say so here,
    // where it was given, rather than wherever the member has got to by then
    if (!saved) toast.error($t("onboarding.steps.welcome.save_failed"));
    return saved;
  } finally {
    saving.value = null;
    pendingSave = null;
  }
};

// picking a card is the answer and the way on
const select = async function (value: OnboardingExperience) {
  if (busy.value) return;
  pendingSave = save(value);
  if (await pendingSave) emit("advance");
};

/**
 * The wizard asking whether it may move off the step. An answer still on its
 * way is waited for here, so the member is not walked onto another step by an
 * answer the account never took, and is told about it on the step that asked.
 */
const beforeLeave = async function (): Promise<boolean> {
  return pendingSave ? await pendingSave : true;
};

// the cards are the way on, so the wizard shows no Next of its own here
const ownsForwardAction = true;

defineExpose({ beforeLeave, busy, ownsForwardAction });
</script>
