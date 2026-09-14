<template>
  <section class="flex flex-col gap-5">
    <p class="text-muted-foreground text-sm">
      {{ $t(`onboarding.steps.${stepId}.description`) }}
    </p>

    <div v-if="done.length > 0" class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">{{ $t(doneHeadingKey) }}</h3>
      <ItemGroup class="gap-2">
        <Item
          v-for="step in done"
          :key="step.id"
          variant="outline"
          size="sm"
          data-testid="onboarding-summary-done"
        >
          <ItemMedia>
            <CircleCheck class="text-primary size-4" aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{{ $t(`onboarding.steps.${step.id}.title`) }}</ItemTitle>
            <ItemDescription v-if="step.id === 'players' && playerCount > 0">
              {{
                $t("onboarding.players_count", playerCount, {
                  named: { count: playerCount },
                })
              }}
            </ItemDescription>
            <!-- the welcome asked one thing; the summary says what came of it -->
            <ItemDescription v-else-if="step.id === 'welcome' && persona">
              {{ $t(`onboarding.steps.welcome.${persona}.label`) }}
            </ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>
    </div>

    <div v-if="pending.length > 0" class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">{{ $t("onboarding.still_to_do") }}</h3>
      <ItemGroup class="gap-2">
        <Item
          v-for="step in pending"
          :key="step.id"
          as="button"
          type="button"
          variant="outline"
          size="sm"
          class="w-full cursor-pointer text-left"
          data-testid="onboarding-summary-pending"
          @click="emit('navigate', step.id)"
        >
          <ItemMedia>
            <Circle class="text-muted-foreground size-4" aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{{ $t(`onboarding.steps.${step.id}.title`) }}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Badge v-if="step.optional || step.deferred" variant="outline">
              {{ $t("optional") }}
            </Badge>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>

    <!-- the member track sets nothing up, so it has no list to be at the end
         of and nothing to say is done -->
    <p v-else-if="!isMemberSummary" class="text-muted-foreground text-sm">
      {{ $t("onboarding.all_done") }}
    </p>

    <div>
      <Button
        :disabled="busy"
        data-testid="onboarding-finish"
        @click="emit('finish')"
      >
        {{ $t("onboarding.finish") }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useOnboarding } from "@/composables/useOnboarding";
import { isTodo, type OnboardingStepId } from "@/helpers/onboarding";
import { Circle, CircleCheck } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  busy?: boolean;
  // which summary this is: the end of the setup, or the end of the welcome
  stepId: OnboardingStepId;
}>();

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { ctx, steps, pending, persona } = useOnboarding();

// A review is nothing to set up and nothing to do, so it is on neither list.
// Neither is a welcome that was only ever shown: being done with the member is
// not the same as the member having picked something, and there is nothing to
// look back at when they walked past the question.
const done = computed(() =>
  steps.value.filter(
    (step) =>
      isTodo(step) &&
      step.isDone(ctx.value) &&
      (step.id !== "welcome" || persona.value != null),
  ),
);
const playerCount = computed(() => ctx.value.playerCount);

const isMemberSummary = computed(() => props.stepId === "all_set");
// a member set nothing up: what their summary looks back at is the answer they
// gave, so it is not headed as a list of things that are now in place
const doneHeadingKey = computed(() =>
  isMemberSummary.value ? "onboarding.what_you_picked" : "onboarding.set_up",
);
</script>
