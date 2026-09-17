<template>
  <section class="flex flex-col gap-4">
    <p :id="DESCRIPTION_ID" class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.intent.description") }}
    </p>

    <ChoiceCards
      :options="options"
      :selected="shown"
      :busy="busy"
      :labelled-by="DESCRIPTION_ID"
      test-id-prefix="onboarding-intent"
      @select="select"
    />

    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.intent.settings_note") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import ChoiceCards, {
  type ChoiceCardOption,
} from "@/components/onboarding/ChoiceCards.vue";
import type { OnboardingIntent, OnboardingStepId } from "@/helpers/onboarding";
import { useOnboarding } from "@/composables/useOnboarding";
import { Library, Smartphone } from "@lucide/vue";
import { computed, markRaw, ref } from "vue";

// what the cards answer, for the screen readers that read it out first
const DESCRIPTION_ID = "onboarding-intent-description";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { intent, setIntent } = useOnboarding();

const options: ChoiceCardOption<OnboardingIntent>[] = [
  {
    value: "music_hub",
    icon: markRaw(Library),
    labelKey: "onboarding.steps.intent.music_hub.label",
    descriptionKey: "onboarding.steps.intent.music_hub.description",
    recommended: true,
  },
  {
    value: "phone_apps",
    icon: markRaw(Smartphone),
    labelKey: "onboarding.steps.intent.phone_apps.label",
    descriptionKey: "onboarding.steps.intent.phone_apps.description",
  },
];

// the answer shown as chosen until the admin picks one
const recommended = options.find((option) => option.recommended)!.value;

// the answer given here, kept even when the account did not take it: the
// card stays chosen, and moving on tries it again
const chosen = ref<OnboardingIntent | null>(null);

// what the cards show as chosen, and what moving on writes: the answer given
// here, else the one on the account, else the recommended one
const shown = computed(() => chosen.value ?? intent.value ?? recommended);

// the answer is persisted on the server, so the cards stay inert until it lands
const busy = ref(false);
// the answer on its way to the server, which the wizard waits for before it
// moves off this step
let pendingSave: Promise<boolean> | null = null;

// whether the answer landed; the api already tells the user when it did not,
// so the step only has to stay where it is
const save = async function (value: OnboardingIntent): Promise<boolean> {
  busy.value = true;
  try {
    return await setIntent(value);
  } finally {
    busy.value = false;
    pendingSave = null;
  }
};

const select = async function (value: OnboardingIntent) {
  if (busy.value) return;
  chosen.value = value;
  pendingSave = save(value);
  if (await pendingSave) emit("advance");
};

/**
 * The wizard asking whether it may move on. An answer still on its way is
 * waited for here, so the wizard never leaves the question on an answer the
 * account has not taken yet. Otherwise moving on writes the answer the cards
 * show as chosen, unless the account already holds it: the recommended
 * option for a question walked past, which is an answer of its own, or the
 * pick the account did not take before. An answer that did not land keeps the
 * wizard here, so the question is never left behind unanswered.
 */
const beforeLeave = async function (): Promise<boolean> {
  if (pendingSave) return await pendingSave;
  if (shown.value === intent.value) return true;
  pendingSave = save(shown.value);
  return await pendingSave;
};

// the wizard reads `busy` to keep its Next from advancing while a card is saving
defineExpose({ beforeLeave, busy });
</script>
