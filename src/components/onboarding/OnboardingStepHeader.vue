<template>
  <div class="flex flex-col items-center gap-3 text-center">
    <span
      class="bg-primary/10 text-primary relative grid size-10 shrink-0 place-items-center rounded-xl"
      aria-hidden="true"
      data-testid="onboarding-step-icon"
    >
      <img
        v-if="icon === 'logo'"
        src="@/assets/icon.svg"
        alt=""
        class="size-6"
      />
      <component :is="icon" v-else class="size-5" />
      <span
        v-if="setUp"
        class="bg-primary text-primary-foreground ring-background absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full ring-2"
        data-testid="onboarding-step-done"
      >
        <Check class="size-2.5" :stroke-width="3.5" />
      </span>
    </span>
    <div class="flex flex-col gap-1">
      <h1
        ref="heading"
        class="text-lg leading-7 font-semibold text-balance outline-none sm:text-xl"
        tabindex="-1"
        data-testid="onboarding-heading"
      >
        {{ title }}
      </h1>
      <p
        :id="STEP_LEAD_ID"
        class="text-muted-foreground text-sm text-pretty"
        data-testid="onboarding-lead"
      >
        {{ lead }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { STEP_LEAD_ID } from "@/helpers/onboarding";
import { Check } from "@lucide/vue";
import { ref, type Component } from "vue";

defineProps<{
  icon: Component | "logo";
  title: string;
  lead: string;
  // a step that is set up wears a tick on its icon
  setUp: boolean;
}>();

const heading = ref<HTMLHeadingElement | null>(null);

const focus = function () {
  heading.value?.focus();
};

defineExpose({ focus });
</script>
