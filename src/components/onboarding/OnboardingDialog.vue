<template>
  <Dialog :open="active" @update:open="onOpenChange">
    <DialogContent
      class="max-h-[calc(100dvh-1rem)] gap-0 overflow-y-auto p-4 sm:max-w-[calc(100%-2rem)] sm:p-6 lg:max-w-3xl"
      :show-close-button="ctx.isMember"
      data-testid="onboarding-modal"
      @escape-key-down="onDismissAttempt"
      @pointer-down-outside="onDismissAttempt"
      @interact-outside="onDismissAttempt"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ $t(titleKey) }}</DialogTitle>
        <DialogDescription>{{ $t(descriptionKey) }}</DialogDescription>
      </DialogHeader>
      <OnboardingWizard v-if="active" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import OnboardingWizard from "@/components/onboarding/OnboardingWizard.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOnboarding } from "@/composables/useOnboarding";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const { active, ctx, close } = useOnboarding();

// the admin sets the server up; the member is welcomed into it
const titleKey = computed(() =>
  ctx.value.isMember ? "onboarding.welcome_title" : "onboarding.title",
);
const descriptionKey = computed(() =>
  ctx.value.isMember
    ? "onboarding.welcome_description"
    : "onboarding.description",
);

// The admin setup is the fresh install's one required task, so its modal holds
// until the wizard is finished or skipped through; the member welcome closes
// freely, and leaving it counts as having been welcomed (the wizard writes that
// marker as it unmounts).
const onDismissAttempt = function (event: Event): void {
  if (!ctx.value.isMember) event.preventDefault();
};

const onOpenChange = function (value: boolean): void {
  if (value || !ctx.value.isMember) return;
  close();
};
</script>
