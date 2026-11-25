<template>
  <section class="flex flex-col gap-3">
    <OnboardingList v-if="done.length + pending.length > 0">
      <Item
        v-for="step in done"
        :key="step.id"
        as="button"
        type="button"
        size="sm"
        class="enabled:hover:bg-accent/50 w-full text-left transition-colors enabled:cursor-pointer"
        :disabled="busy || step.oneWay"
        data-testid="onboarding-summary-done"
        @click="emit('navigate', step.id)"
      >
        <ItemMedia class="size-8">
          <CircleCheck class="text-primary size-5" aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t(doneTitleKey(step.id)) }}</ItemTitle>
          <ItemDescription v-if="countLabels[step.id]">
            {{ countLabels[step.id] }}
          </ItemDescription>
          <ItemDescription
            v-else-if="step.id === 'intent' && ctx.answers.intent"
          >
            {{ $t(`onboarding.steps.intent.${ctx.answers.intent}.title`) }}
          </ItemDescription>
          <!-- the welcome asked one thing; the summary says what came of it -->
          <ItemDescription
            v-else-if="step.id === 'welcome' && expertMode != null"
          >
            {{
              $t(`onboarding.steps.welcome.${experienceOf(expertMode)}.label`)
            }}
          </ItemDescription>
        </ItemContent>
        <ItemActions v-if="!step.oneWay">
          <ChevronRight
            class="text-muted-foreground size-4"
            aria-hidden="true"
          />
        </ItemActions>
      </Item>

      <Item
        v-for="step in pending"
        :key="step.id"
        as="button"
        type="button"
        size="sm"
        class="hover:bg-accent/50 w-full cursor-pointer text-left transition-colors"
        :disabled="busy"
        :data-testid="
          step.optional
            ? 'onboarding-summary-optional'
            : 'onboarding-summary-pending'
        "
        @click="emit('navigate', step.id)"
      >
        <ItemMedia class="size-8">
          <Circle
            v-if="step.optional"
            class="text-muted-foreground size-5"
            aria-hidden="true"
          />
          <CircleAlert
            v-else
            class="size-5 text-amber-500"
            aria-hidden="true"
          />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t(stepTitleKey(step.id, ctx.answers)) }}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Badge
            variant="outline"
            :class="
              step.optional ? undefined : 'border-amber-500/40 text-amber-500'
            "
          >
            {{ step.optional ? $t("optional") : $t("onboarding.still_to_do") }}
          </Badge>
          <ChevronRight
            class="text-muted-foreground size-4"
            aria-hidden="true"
          />
        </ItemActions>
      </Item>
    </OnboardingList>

    <!-- how to play from each music app connected, for the app setup -->
    <OnboardingList v-if="receivers.length > 0">
      <Item
        v-for="receiver in receivers"
        :key="receiver.instructionKey"
        size="sm"
        data-testid="onboarding-receiver-instructions"
      >
        <ItemMedia variant="icon">
          <ProviderIcon
            :domain="receiver.domain"
            :size="20"
            aria-hidden="true"
          />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ receiver.name }}</ItemTitle>
          <ItemDescription class="line-clamp-none">
            {{ $t(receiver.instructionKey) }}
          </ItemDescription>
        </ItemContent>
      </Item>
    </OnboardingList>
  </section>
</template>

<script setup lang="ts">
import OnboardingList from "@/components/onboarding/OnboardingList.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  configuredAudioSourcePlugins,
  configuredProviders,
  useOnboarding,
} from "@/composables/useOnboarding";
import {
  APP_RECEIVER_INSTRUCTIONS,
  experienceOf,
  isTodo,
  stepTitleKey,
  type OnboardingStepId,
} from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ChevronRight, Circle, CircleAlert, CircleCheck } from "@lucide/vue";
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

const { ctx, steps, pending: pendingSteps, expertMode } = useOnboarding();

const isMemberSummary = computed(() => props.stepId === "all_set");
const appFirst = computed(
  () => !isMemberSummary.value && ctx.value.answers.intent === "phone_apps",
);

// The account comes before every other step and cannot be undone, so the
// summary never lists it: it is neither something to look back on nor ever
// still to do. Essentials still to do come before the optional extras.
const pending = computed(() => [
  ...pendingSteps.value.filter(
    (step) => !step.optional && step.id !== "account",
  ),
  ...pendingSteps.value.filter((step) => step.optional),
]);

const receivers = computed(() =>
  !appFirst.value
    ? []
    : configuredAudioSourcePlugins()
        .filter((provider) => !provider.needsAttention)
        .flatMap((provider) => {
          const instructionKey = APP_RECEIVER_INSTRUCTIONS[provider.domain];
          return instructionKey
            ? [{ domain: provider.domain, name: provider.name, instructionKey }]
            : [];
        }),
);

// A review is nothing to set up and nothing to do, so it is on neither list.
// Neither is a welcome the member only closed: being done with them is not the
// same as an answer on the account, and there is nothing to look back at when
// none was ever written.
const done = computed(() =>
  steps.value.filter(
    (step) =>
      isTodo(step) &&
      step.isDone(ctx.value) &&
      // own_sources is an invitation, listed as optional while it is open, not
      // a choice to look back on once it is done
      step.id !== "own_sources" &&
      step.id !== "account" &&
      (step.id !== "welcome" || expertMode.value != null),
  ),
);
const countLabel = (key: string, count: number) =>
  count > 0 ? $t(key, count, { named: { count } }) : undefined;
// the setup choice is looked back on as the choice made, not the question asked
const doneTitleKey = (id: OnboardingStepId) =>
  id === "intent"
    ? "onboarding.steps.intent.summary_title"
    : stepTitleKey(id, ctx.value.answers);
const countLabels = computed<Partial<Record<OnboardingStepId, string>>>(() => ({
  players: countLabel("onboarding.players_count", ctx.value.playerCount),
  music_sources: countLabel(
    "onboarding.music_sources_count",
    configuredProviders(ProviderType.MUSIC).length,
  ),
  plugins: countLabel(
    "onboarding.plugins_count",
    configuredAudioSourcePlugins().length,
  ),
}));
</script>
