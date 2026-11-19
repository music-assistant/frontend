<template>
  <section class="flex flex-col gap-4">
    <p
      :id="DESCRIPTION_ID"
      class="text-muted-foreground text-center text-sm text-balance"
    >
      {{ $t("onboarding.steps.intent.starting_point") }}
    </p>

    <ChoiceCards
      :options="options"
      :selected="shown"
      :busy="busy"
      :labelled-by="DESCRIPTION_ID"
      test-id-prefix="onboarding-intent"
      @select="select"
    />
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
    labelKey: "onboarding.steps.intent.music_hub.title",
    descriptionKey: "onboarding.steps.intent.music_hub.details",
    recommended: true,
  },
  {
    value: "phone_apps",
    icon: markRaw(Smartphone),
    labelKey: "onboarding.steps.intent.phone_apps.title",
    descriptionKey: "onboarding.steps.intent.phone_apps.details",
  },
];

// the answer on its way to the server; the cards stay inert until it lands
const saving = ref<OnboardingIntent | null>(null);
const busy = computed(() => saving.value != null);
// that save, which the wizard waits for before it moves off this step
let pendingSave: Promise<boolean> | null = null;

// the card shown as chosen: the answer being saved, else the one on the account
const shown = computed(() => saving.value ?? intent.value);

// whether the answer landed; the api already tells the user when it did not,
// so the step only has to stay where it is
const save = async function (value: OnboardingIntent): Promise<boolean> {
  saving.value = value;
  try {
    return await setIntent(value);
  } finally {
    saving.value = null;
    pendingSave = null;
  }
};

// picking a card is the answer and the way on, so the question is never
// walked past unanswered
const select = async function (value: OnboardingIntent) {
  if (busy.value) return;
  pendingSave = save(value);
  if (await pendingSave) emit("advance");
};

/**
 * The wizard asking whether it may move off the step. An answer still on its
 * way is waited for, and one that did not land keeps the wizard here.
 */
const beforeLeave = async function (): Promise<boolean> {
  return pendingSave ? await pendingSave : true;
};

// the cards are the way on, so the wizard shows no Next of its own here
const ownsForwardAction = true;

defineExpose({ beforeLeave, busy, ownsForwardAction });
</script>
