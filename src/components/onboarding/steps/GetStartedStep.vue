<template>
  <section class="flex flex-col gap-4">
    <p
      class="text-muted-foreground text-sm"
      data-testid="onboarding-get-started"
    >
      {{ $t("onboarding.steps.get_started.description") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import type { OnboardingStepId } from "@/helpers/onboarding";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();
</script>
