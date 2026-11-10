<template>
  <Dialog :open="active" @update:open="onOpenChange">
    <!-- one layer below the other dialogs, so a setup flow or confirmation
         opened from the wizard shows on top of it. Fixed height so the header
         and Next stay put when a step changes size; the wizard scrolls the
         step inside it -->
    <DialogContent
      class="z-[9998] flex h-[calc(100dvh-1rem)] flex-col gap-0 overflow-hidden p-4 sm:h-[min(84dvh,44rem)] sm:max-w-[calc(100%-2rem)] sm:p-6 lg:max-w-3xl"
      overlay-class="z-[9998]"
      :close-label="$t('onboarding.pause')"
      data-testid="onboarding-modal"
      @pointer-down-outside="onOutsideInteraction"
      @interact-outside="onOutsideInteraction"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ $t("onboarding.title") }}</DialogTitle>
        <DialogDescription>{{
          $t("onboarding.description")
        }}</DialogDescription>
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
import { defineAsyncComponent, h, onBeforeUnmount } from "vue";
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

const { active, pause } = useOnboarding();
const router = useRouter();

// The setup closes by pausing it, through the close button or Escape. A click
// beside it is too easy to make by accident, so it does not close on that.
const onOutsideInteraction = function (event: Event): void {
  event.preventDefault();
};

const onOpenChange = function (value: boolean): void {
  if (!value) void pause();
};

// Anything that takes the user to another page has taken them out of the
// wizard, so it lets go instead of covering the page they went to.
const removeRouteGuard = router.afterEach((to, from, failure) => {
  if (failure || !active.value) return;
  if (from === START_LOCATION || to.path === from.path) return;
  void pause({ force: true });
});

// The open state is a module singleton, and the app shell tears the dialog down
// when the connection drops (a sign-out reloads the page). The setup is left as
// it was, so it comes back open or paused on its step.
onBeforeUnmount(() => {
  removeRouteGuard();
});
</script>
