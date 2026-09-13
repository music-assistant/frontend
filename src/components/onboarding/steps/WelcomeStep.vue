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
      :selected="persona"
      :busy="busy"
      :labelled-by="DESCRIPTION_ID"
      test-id-prefix="onboarding-persona"
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
import type { OnboardingPersona, OnboardingStepId } from "@/helpers/onboarding";
import { userDisplayName } from "@/helpers/provider_access";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { AudioLines, Play } from "@lucide/vue";
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

const { persona, setPersona } = useOnboarding();

// the welcome only ever opens on someone who is signed in, so the empty name
// is there for the type rather than for a greeting anyone will read
const name = computed(() =>
  store.currentUser ? userDisplayName(store.currentUser) : "",
);

const options = [
  {
    value: "enthusiast",
    icon: markRaw(AudioLines),
    labelKey: "onboarding.steps.welcome.enthusiast.label",
    descriptionKey: "onboarding.steps.welcome.enthusiast.description",
  },
  {
    value: "regular",
    icon: markRaw(Play),
    labelKey: "onboarding.steps.welcome.regular.label",
    descriptionKey: "onboarding.steps.welcome.regular.description",
  },
] satisfies ChoiceCardOption<OnboardingPersona>[];

// the answer is persisted on the server, so the cards stay inert until it lands
const busy = ref(false);

const select = async function (value: OnboardingPersona) {
  if (busy.value) return;
  busy.value = true;
  let saved = false;
  try {
    saved = await setPersona(value);
  } finally {
    busy.value = false;
  }
  // an answer that did not reach the server is not an answer: the step says so
  // and stays put, rather than walking on as if the account had taken it
  if (!saved) {
    toast.error($t("onboarding.steps.welcome.save_failed"));
    return;
  }
  emit("advance");
};
</script>
