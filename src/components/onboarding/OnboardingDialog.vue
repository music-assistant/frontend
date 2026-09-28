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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useOnboarding } from "@/composables/useOnboarding";
import { $t } from "@/plugins/i18n";
import { computed, defineAsyncComponent, h, onBeforeUnmount } from "vue";

// The wizard pulls in every step and the setup dialogs behind them. Load that
// chunk only when onboarding opens, so it stays out of the initial app bundle
// that every session pays for.
const OnboardingWizard = defineAsyncComponent({
  loader: () => import("@/components/onboarding/OnboardingWizard.vue"),
  loadingComponent: {
    render: () =>
      h(
        "div",
        { class: "flex min-h-40 items-center justify-center" },
        h(Spinner, { class: "size-6" }),
      ),
  },
});

const { active, ctx, close, markWelcomed } = useOnboarding();

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
  // leaving the welcome counts as having been welcomed; marked here rather than
  // in the wizard, which loads asynchronously and may not have mounted yet when
  // a member closes. The composable deduplicates, so the wizard marking too is
  // harmless.
  void markWelcomed();
  close();
};

// The open state is a module singleton. Reset it when the app shell tears the
// dialog down (a sign-out or a dropped connection), so the next session on the
// same page load never inherits an onboarding that was left open.
onBeforeUnmount(() => close());
</script>
