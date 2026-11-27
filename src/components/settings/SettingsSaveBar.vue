<template>
  <div v-if="inline" class="mt-4 flex justify-end">
    <slot />
  </div>
  <template v-else>
    <!-- outlives the bar, so its text changes in place and gets announced -->
    <p role="status" class="sr-only">
      {{ unsavedChanges ? $t("settings.unsaved_changes") : "" }}
    </p>
    <Transition
      enter-active-class="animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
      leave-active-class="animate-out fade-out slide-out-to-bottom-2 duration-150 motion-reduce:animate-none"
    >
      <!-- sticks to the bottom of the screen while its form is in view, and rests
           below the form's last row once that scrolls into view -->
      <div
        v-if="unsavedChanges"
        data-testid="settings-save-bar"
        :class="[
          'sticky z-20 mt-4 flex items-center gap-3 rounded-xl border bg-card py-3 pr-3 pl-5 shadow-lg',
          bottomClass,
        ]"
      >
        <p
          aria-hidden="true"
          class="m-0 flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
        >
          <span class="size-2 shrink-0 rounded-full bg-primary"></span>
          {{ $t("settings.unsaved_changes") }}
        </p>
        <div class="ml-auto shrink-0">
          <slot />
        </div>
      </div>
    </Transition>
  </template>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed } from "vue";

/**
 * The save action of a settings form, in its default slot: a bar pinned to the
 * bottom of the page while there are unsaved changes, or always in the flow of
 * the form below its last row.
 */
defineProps<{
  // in the flow of the form, for a form in a dialog or in a frame of its own
  inline?: boolean;
  unsavedChanges: boolean;
}>();

// a sticky offset counts from the page's padding; the mobile page keeps room
// below its content for the bars it scrolls under, more than the bar needs to
// clear them and the blur above them. The desktop page ends above its player bar.
const bottomClass = computed(() =>
  store.mobileLayout && !store.frameless
    ? "bottom-[calc(var(--mobile-player-scrim-height)-var(--mobile-page-clearance))]"
    : "bottom-4",
);
</script>
