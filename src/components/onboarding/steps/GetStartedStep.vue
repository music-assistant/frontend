<template>
  <OnboardingInvitation
    :features="FEATURES"
    data-testid="onboarding-get-started"
  />
</template>

<script setup lang="ts">
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { Compass, Music, Sparkles, UserRound } from "@lucide/vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const FEATURES: readonly InvitationFeature[] = [
  {
    icon: UserRound,
    labelKey: "onboarding.steps.get_started.features.account",
  },
  { icon: Compass, labelKey: "onboarding.steps.get_started.features.intent" },
  { icon: Music, labelKey: "onboarding.steps.get_started.features.music" },
  { icon: Sparkles, labelKey: "onboarding.steps.get_started.features.extras" },
];
</script>
