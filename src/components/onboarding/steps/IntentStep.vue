<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.intent.description") }}
    </p>

    <ChoiceCards
      :options="options"
      :selected="intent"
      :busy="busy"
      test-id-prefix="onboarding-intent"
      @select="select"
    />
  </section>
</template>

<script setup lang="ts">
import ChoiceCards from "@/components/onboarding/ChoiceCards.vue";
import type { OnboardingIntent, OnboardingStepId } from "@/helpers/onboarding";
import { useOnboarding } from "@/composables/useOnboarding";
import { Library, Smartphone } from "@lucide/vue";
import { markRaw, ref } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { intent, setIntent } = useOnboarding();

const options = [
  {
    value: "phone_apps" as OnboardingIntent,
    icon: markRaw(Smartphone),
    labelKey: "onboarding.steps.intent.phone_apps.label",
    descriptionKey: "onboarding.steps.intent.phone_apps.description",
  },
  {
    value: "music_hub" as OnboardingIntent,
    icon: markRaw(Library),
    labelKey: "onboarding.steps.intent.music_hub.label",
    descriptionKey: "onboarding.steps.intent.music_hub.description",
  },
];

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
</script>
