<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm" data-testid="onboarding-greeting">
      {{ $t("onboarding.steps.welcome.description", { name }) }}
    </p>

    <ChoiceCards
      :options="options"
      :selected="persona"
      :busy="busy"
      test-id-prefix="onboarding-persona"
      @select="select"
    />

    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.welcome.defaults_hint") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import ChoiceCards from "@/components/onboarding/ChoiceCards.vue";
import { useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingPersona, OnboardingStepId } from "@/helpers/onboarding";
import { userDisplayName } from "@/helpers/provider_access";
import { store } from "@/plugins/store";
import { AudioLines, Play } from "@lucide/vue";
import { computed, markRaw, ref } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { persona, setPersona } = useOnboarding();

// the welcome only ever opens on someone who is signed in, so the empty name
// is there for the type rather than for a greeting anyone will read
const name = computed(() =>
  store.currentUser ? userDisplayName(store.currentUser) : "",
);

const options = [
  {
    value: "enthusiast" as OnboardingPersona,
    icon: markRaw(AudioLines),
    labelKey: "onboarding.steps.welcome.enthusiast.label",
    descriptionKey: "onboarding.steps.welcome.enthusiast.description",
  },
  {
    value: "regular" as OnboardingPersona,
    icon: markRaw(Play),
    labelKey: "onboarding.steps.welcome.regular.label",
    descriptionKey: "onboarding.steps.welcome.regular.description",
  },
];

// the answer is persisted on the server, so the cards stay inert until it lands
const busy = ref(false);

const select = async function (value: OnboardingPersona) {
  if (busy.value) return;
  busy.value = true;
  try {
    await setPersona(value);
  } finally {
    busy.value = false;
  }
  emit("advance");
};
</script>
