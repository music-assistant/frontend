<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.your_players.description") }}
    </p>

    <template v-if="players.length > 0">
      <ItemGroup class="gap-2">
        <Item
          v-for="player in listed"
          :key="player.player_id"
          variant="outline"
          size="sm"
          data-testid="onboarding-player"
        >
          <ItemMedia variant="icon">
            <PlayerIcon :icon="player.icon" aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{{ player.name }}</ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>

      <!-- the players are named up to a point; the rest are counted, so a
           home with a dozen of them still reads as a short step -->
      <p
        v-if="more > 0"
        class="text-muted-foreground text-sm"
        data-testid="onboarding-more-players"
      >
        {{ $t("onboarding.more_count", { count: more }) }}
      </p>
    </template>

    <Empty v-else class="border-border rounded-md border border-dashed py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Speaker />
        </EmptyMedia>
        <EmptyTitle>{{ $t("onboarding.steps.your_players.empty") }}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  </section>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useOrderedPlayers } from "@/composables/useOrderedPlayers";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { Speaker } from "@lucide/vue";
import { computed } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

// how many are named before the rest are only counted
const NAMED_LIMIT = 6;

// The players this member may play to, as every picker lists them, bar the two
// nudges that are about what is on right now: this step is about what is in
// the house, so it stays in the same order however the music moves.
const players = useOrderedPlayers({
  selectedPlayerFirst: false,
  activePlayersFirst: false,
});

const listed = computed(() => players.value.slice(0, NAMED_LIMIT));
const more = computed(() => players.value.length - listed.value.length);
</script>
