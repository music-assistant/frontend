<script setup lang="ts">
import type { OnboardingStepId } from "@/helpers/onboarding";
import { $t } from "@/plugins/i18n";
import { Check } from "@lucide/vue";

/** One entry in the progress list: a step and whether it is ticked off. */
interface ProgressStep {
  id: OnboardingStepId;
  done: boolean;
}

const props = defineProps<{
  steps: ProgressStep[];
  // index of the step on screen, in the same order as `steps`
  current: number;
}>();

const emit = defineEmits<{
  (e: "navigate", step: OnboardingStepId): void;
}>();

// only a step already behind the current one can be jumped to; the wizard
// itself walks the user forward, one step at a time
const canRevisit = (index: number): boolean => index < props.current;

const onClick = function (index: number, id: OnboardingStepId): void {
  if (canRevisit(index)) emit("navigate", id);
};
</script>

<template>
  <div class="flex items-center" data-testid="onboarding-progress">
    <template v-for="(step, index) in steps" :key="step.id">
      <button
        type="button"
        :disabled="!canRevisit(index)"
        :aria-current="index === current ? 'step' : undefined"
        :aria-label="$t(`onboarding.steps.${step.id}.title`)"
        :title="$t(`onboarding.steps.${step.id}.title`)"
        class="focus-visible:ring-ring flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
        :class="[
          index === current
            ? 'border-primary bg-primary text-primary-foreground'
            : index < current
              ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
              : 'border-input text-muted-foreground bg-transparent',
        ]"
        data-testid="onboarding-progress-step"
        @click="onClick(index, step.id)"
      >
        <Check
          v-if="step.done && index !== current"
          class="size-3.5"
          aria-hidden="true"
        />
        <span v-else>{{ index + 1 }}</span>
      </button>
      <span
        v-if="index < steps.length - 1"
        class="h-px flex-1"
        :class="index < current ? 'bg-primary' : 'bg-border'"
        aria-hidden="true"
      ></span>
    </template>
  </div>
</template>
