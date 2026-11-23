<template>
  <div class="flex flex-col gap-3">
    <OnboardingList v-if="!setUp" data-testid="onboarding-invitation-features">
      <Item v-for="feature in features" :key="feature.labelKey" size="sm">
        <ItemMedia class="text-primary size-8 place-items-center">
          <component :is="feature.icon" class="size-5" aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle class="font-normal">{{ $t(feature.labelKey) }}</ItemTitle>
        </ItemContent>
      </Item>
    </OnboardingList>
    <slot v-else></slot>

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
import OnboardingList from "@/components/onboarding/OnboardingList.vue";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";

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
