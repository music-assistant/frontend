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
            <ItemDescription v-if="countLabels[step.id]">
              {{ countLabels[step.id] }}
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
          class="hover:bg-accent/50 w-full cursor-pointer text-left transition-colors"
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
            <ChevronRight
              class="text-muted-foreground size-4"
              aria-hidden="true"
            />
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>

    <p v-else class="text-muted-foreground text-sm">
      {{ $t("onboarding.all_done") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  configuredProviders,
  useOnboarding,
} from "@/composables/useOnboarding";
import { isTodo, type OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ChevronRight, Circle, CircleCheck } from "@lucide/vue";
import { computed } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
}>();

const { ctx, steps, pending } = useOnboarding();

// A review is nothing to set up and nothing to do, so it is on neither list.
const done = computed(() =>
  steps.value.filter((step) => isTodo(step) && step.isDone(ctx.value)),
);
const countLabel = (key: string, count: number) =>
  count > 0 ? $t(key, count, { named: { count } }) : undefined;
const countLabels = computed<Partial<Record<OnboardingStepId, string>>>(() => ({
  players: countLabel("onboarding.players_count", ctx.value.playerCount),
  music_sources: countLabel(
    "onboarding.music_sources_count",
    configuredProviders(ProviderType.MUSIC).length,
  ),
  plugins: countLabel(
    "onboarding.plugins_count",
    configuredProviders(ProviderType.PLUGIN).length,
  ),
}));
</script>
