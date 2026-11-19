<template>
  <div class="flex flex-col items-center gap-4">
    <div
      class="flex items-center"
      aria-hidden="true"
      data-testid="onboarding-invitation-visual"
      :data-linked="linked || undefined"
    >
      <span :class="MARK_CLASS">
        <img src="@/assets/icon.svg" alt="" class="size-8" />
      </span>
      <span :class="lineClass"></span>
      <span :class="knotClass">
        <Check v-if="linked" class="size-4" />
        <Link v-else class="size-4" />
      </span>
      <span :class="lineClass"></span>
      <span :class="MARK_CLASS">
        <slot name="partner"></slot>
      </span>
    </div>

    <p
      class="text-muted-foreground max-w-xl text-center text-sm"
      data-testid="onboarding-invitation-intro"
    >
      {{ intro }}
    </p>

    <div v-if="!setUp" class="flex w-fit max-w-md flex-col gap-2">
      <p
        v-if="featuresTitle"
        class="text-muted-foreground text-xs"
        data-testid="onboarding-invitation-features-title"
      >
        {{ featuresTitle }}
      </p>
      <ul
        class="flex flex-col gap-2"
        data-testid="onboarding-invitation-features"
      >
        <li
          v-for="feature in features"
          :key="feature.labelKey"
          class="flex items-center gap-3 text-sm"
        >
          <span
            class="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-md"
          >
            <component :is="feature.icon" class="size-4" aria-hidden="true" />
          </span>
          {{ $t(feature.labelKey) }}
        </li>
      </ul>
    </div>

    <div class="flex w-full max-w-md flex-col gap-3">
      <slot></slot>
      <p
        v-if="optional && !setUp"
        class="text-muted-foreground text-center text-xs"
        data-testid="onboarding-invitation-optional"
      >
        {{ optional }}
      </p>
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script lang="ts">
import type { Component } from "vue";

/** Something a step brings, shown as a line with its icon. */
export interface InvitationFeature {
  icon: Component;
  labelKey: string;
}
</script>

<script setup lang="ts">
import { cn } from "@/lib/utils";
import { Check, Link } from "@lucide/vue";
import { computed } from "vue";

/**
 * The layout of a setup wizard step that invites to set up something
 * optional: Music Assistant's logo linked to the `partner` slot, an intro, what
 * it brings, then the default slot for the action or what is set up, the
 * optional line and the `footer` slot. Once it is set up, what it brings and
 * the optional line make way for the slot.
 */
const props = defineProps<{
  intro: string;
  features: readonly InvitationFeature[];
  // a caption over what it brings
  featuresTitle?: string;
  setUp?: boolean;
  // set up and working: the link between the two marks is made
  linked?: boolean;
  // that the step can be left for later, and where to find it then
  optional?: string;
}>();

const MARK_CLASS =
  "bg-muted text-primary flex size-14 items-center justify-center rounded-2xl border [&>svg]:size-7";

const lineClass = computed(() =>
  cn(
    "w-6 border-t-2 sm:w-10",
    props.linked ? "border-primary" : "border-muted-foreground/40",
  ),
);
const knotClass = computed(() =>
  cn(
    "flex size-8 items-center justify-center rounded-full border-2",
    props.linked
      ? "border-primary bg-primary text-primary-foreground"
      : "border-muted-foreground/40 text-muted-foreground",
  ),
);
</script>
