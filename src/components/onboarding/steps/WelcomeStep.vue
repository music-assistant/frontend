<template>
  <section class="flex flex-col gap-4">
    <p
      :id="DESCRIPTION_ID"
      class="text-muted-foreground text-sm"
      data-testid="onboarding-greeting"
    >
      {{ $t("onboarding.steps.welcome.description", { name }) }}
    </p>

    <ChoiceCards
      :options="options"
      :selected="shown"
      :busy="busy"
      :labelled-by="DESCRIPTION_ID"
      test-id-prefix="onboarding-experience"
      @select="select"
    />

    <p class="text-muted-foreground text-sm">
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
  type OnboardingExperience,
  type OnboardingStepId,
} from "@/helpers/onboarding";
import { userDisplayName } from "@/helpers/provider_access";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Play, SlidersHorizontal } from "@lucide/vue";
import { computed, markRaw, ref } from "vue";
import { toast } from "vue-sonner";

// what the cards answer, for the screen readers that read it out first
const DESCRIPTION_ID = "onboarding-welcome-description";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { expertMode, setExpertMode } = useOnboarding();

// the welcome only ever opens on someone who is signed in, so the empty name
// is there for the type rather than for a greeting anyone will read
const name = computed(() =>
  store.currentUser ? userDisplayName(store.currentUser) : "",
);

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
