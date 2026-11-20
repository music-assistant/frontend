<script setup lang="ts">
import type { OnboardingStepId } from "@/helpers/onboarding";
import { $t } from "@/plugins/i18n";

/** One entry in the progress list: a step and whether it is ticked off. */
interface ProgressStep {
  id: OnboardingStepId;
  done: boolean;
  titleKey?: string;
}

const props = defineProps<{
  steps: ProgressStep[];
  // index of the step on screen, in the same order as `steps`
  current: number;
}>();

const emit = defineEmits<{
  (e: "navigate", step: OnboardingStepId): void;
}>();

const canRevisit = (index: number): boolean => index < props.current;

const onClick = function (index: number, id: OnboardingStepId): void {
  if (canRevisit(index)) emit("navigate", id);
};

const title = (step: ProgressStep): string =>
  $t(step.titleKey ?? `onboarding.steps.${step.id}.title`);

// a completed step reads its title plus "completed" for a screen reader, since
// the colour that says so to sighted users carries no text of its own
const stepLabel = function (step: ProgressStep, index: number): string {
  return step.done && index !== props.current
    ? $t("onboarding.step_completed", { step: title(step) })
    : title(step);
};

// done and current are filled, a step walked past without finishing it is
// muted, and one still ahead is filled faintly once it is already done
const segmentClass = function (step: ProgressStep, index: number): string {
  if (index === props.current) return "bg-primary ring-primary/25 ring-3";
  if (index < props.current) {
    return step.done ? "bg-primary" : "bg-muted-foreground/50";
  }
  return step.done ? "bg-primary/40" : "bg-border";
};
</script>

<template>
  <div class="flex items-center gap-1" data-testid="onboarding-progress">
    <!-- the segment is thin, the button around it tall enough to hit -->
    <button
      v-for="(step, index) in steps"
      :key="step.id"
      type="button"
      :disabled="!canRevisit(index)"
      :aria-current="index === current ? 'step' : undefined"
      :aria-label="stepLabel(step, index)"
      :title="title(step)"
      class="group focus-visible:ring-ring flex-1 rounded-full py-2 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default"
      data-testid="onboarding-progress-step"
      :data-done="step.done || undefined"
      @click="onClick(index, step.id)"
    >
      <span
        class="block h-1 rounded-full transition-colors group-enabled:group-hover:opacity-70"
        :class="segmentClass(step, index)"
      ></span>
    </button>
  </div>
</template>
