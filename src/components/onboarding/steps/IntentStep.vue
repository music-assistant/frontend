<template>
  <section class="flex flex-col gap-4">
    <p :id="DESCRIPTION_ID" class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.intent.description") }}
    </p>

    <ChoiceCards
      :options="options"
      :selected="intent"
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
import { markRaw, ref } from "vue";

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

// what moving on unanswered answers with: the option shown as chosen all along
const recommended = options.find((option) => option.recommended)!.value;

// the answer is persisted on the server, so the cards stay inert until it lands
const busy = ref(false);

const select = async function (value: OnboardingIntent) {
  if (busy.value) return;
  busy.value = true;
  try {
    await setIntent(value);
  } finally {
    busy.value = false;
  }
  emit("advance");
};

/**
 * The wizard asking whether it may move on. Moving on from the question
 * unanswered is an answer of its own: the recommended option, which the cards
 * were showing as chosen, is what the wizard runs as from here, instead of
 * leaving the question to be asked again.
 */
const beforeLeave = async function (): Promise<boolean> {
  if (intent.value == null) await setIntent(recommended);
  return true;
};

// the wizard reads `busy` to keep its Next from advancing while a card is saving
defineExpose({ beforeLeave, busy });
</script>
