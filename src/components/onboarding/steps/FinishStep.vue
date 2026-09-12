<template>
  <section class="flex flex-col gap-5">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.finish.description") }}
    </p>

    <div v-if="done.length > 0" class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">{{ $t("onboarding.set_up") }}</h3>
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
            <Badge v-if="step.optional" variant="outline">
              {{ $t("optional") }}
            </Badge>
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>

    <p v-else class="text-muted-foreground text-sm">
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
import type { OnboardingStepId } from "@/helpers/onboarding";
import { Circle, CircleCheck } from "@lucide/vue";
import { computed } from "vue";

defineProps<{
  busy?: boolean;
}>();

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { ctx, steps, pending } = useOnboarding();

const done = computed(() =>
  steps.value.filter(
    (step) => step.kind !== "summary" && step.isDone(ctx.value),
  ),
);
const playerCount = computed(() => ctx.value.playerCount);
</script>
