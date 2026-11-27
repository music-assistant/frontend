<template>
  <div class="flex flex-col gap-3">
    <!-- what it brings is read, not picked: a flat panel with no borders,
         dividers or hover, so it does not look like the rows a step offers
         to click -->
    <ul
      v-if="!setUp"
      class="bg-muted/60 flex flex-col gap-3 rounded-xl p-4"
      data-testid="onboarding-invitation-features"
    >
      <li
        v-for="feature in features"
        :key="feature.labelKey"
        class="flex items-center gap-3 text-sm"
      >
        <span
          class="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-lg"
          aria-hidden="true"
        >
          <component :is="feature.icon" class="size-4" />
        </span>
        {{ $t(feature.labelKey) }}
      </li>
    </ul>
    <slot v-else />

    <p
      v-if="note"
      class="text-muted-foreground text-center text-xs text-pretty"
      data-testid="onboarding-invitation-note"
    >
      {{ note }}
    </p>
  </div>
</template>

<script lang="ts">
import type { Component } from "vue";

/** Something a step brings, shown as a row with its icon. */
export interface InvitationFeature {
  icon: Component;
  labelKey: string;
}
</script>

<script setup lang="ts">
/**
 * The body of a setup wizard step that invites to set something up: what it
 * brings until it is set up, the slot (what is set up) after that, and a note
 * under either.
 */
defineProps<{
  features: readonly InvitationFeature[];
  setUp?: boolean;
  // one short line under the list, such as where to find the step later
  note?: string;
}>();
</script>
