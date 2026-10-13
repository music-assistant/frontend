<template>
  <Dialog :open="active" @update:open="onOpenChange">
    <!-- one layer below the other dialogs, so a setup flow or confirmation
         opened from the wizard shows on top of it -->
    <DialogContent
      class="z-[9998] max-h-[calc(100dvh-1rem)] gap-0 overflow-y-auto p-4 sm:max-w-[calc(100%-2rem)] sm:p-6 lg:max-w-3xl"
      overlay-class="z-[9998]"
      :show-close-button="canLeave"
      :close-label="ctx.isMember ? undefined : $t('onboarding.pause')"
      data-testid="onboarding-modal"
      @escape-key-down="onEscape"
      @pointer-down-outside="onOutsideInteraction"
      @interact-outside="onOutsideInteraction"
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
import { useFirstRunSetup } from "@/composables/useFirstRunSetup";
import { useOnboarding } from "@/composables/useOnboarding";
import { $t } from "@/plugins/i18n";
import { computed, defineAsyncComponent, h, onBeforeUnmount } from "vue";
import { START_LOCATION, useRouter } from "vue-router";

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

const { active, ctx, close, pause, markWelcomed } = useOnboarding();
const { awaitingAccount } = useFirstRunSetup();
const router = useRouter();

// the setup can be paused at any point, except before its account exists:
// without one there is no app to go back to
const canLeave = computed(() => ctx.value.isMember || !awaitingAccount.value);

// the admin sets the server up; the member is welcomed into it
const titleKey = computed(() =>
  ctx.value.isMember ? "onboarding.welcome_title" : "onboarding.title",
);
const descriptionKey = computed(() =>
  ctx.value.isMember
    ? "onboarding.welcome_description"
    : "onboarding.description",
);

const leaveWelcome = function (): void {
  // leaving the welcome counts as having been welcomed; marked here rather than
  // in the wizard, which loads asynchronously and may not have mounted yet when
  // a member closes. The composable deduplicates, so the wizard marking too is
  // harmless.
  void markWelcomed();
  close();
};

// The admin setup closes by pausing it, through the close button or Escape. A
// click beside it is too easy to make by accident, so only the welcome closes on
// that.
const onOutsideInteraction = function (event: Event): void {
  if (!ctx.value.isMember) event.preventDefault();
};

const onEscape = function (event: Event): void {
  if (!canLeave.value) event.preventDefault();
};

const onOpenChange = function (value: boolean): void {
  if (value) return;
  if (ctx.value.isMember) leaveWelcome();
  else void pause();
};

// Anything that takes the user to another page has taken them out of the
// wizard, so it lets go instead of covering the page they went to.
const removeRouteGuard = router.afterEach((to, from, failure) => {
  if (failure || !active.value || !canLeave.value) return;
  if (from === START_LOCATION || to.path === from.path) return;
  if (ctx.value.isMember) leaveWelcome();
  else void pause({ force: true });
});

// The open state is a module singleton, and the app shell tears the dialog down
// when the connection drops (a sign-out reloads the page). The welcome closes;
// an admin setup is left as it was, so it comes back open or paused on its step.
onBeforeUnmount(() => {
  removeRouteGuard();
  if (ctx.value.isMember) close();
});
</script>
