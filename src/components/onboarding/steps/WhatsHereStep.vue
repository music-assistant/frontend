<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.whats_here.description") }}
    </p>

    <Card>
      <CardHeader>
        <CardTitle>
          {{ $t("onboarding.steps.whats_here.listen.title") }}
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <ItemGroup v-if="sources.length > 0" class="gap-2">
          <Item
            v-for="source in listedSources"
            :key="source.instance_id"
            variant="outline"
            size="sm"
            data-testid="onboarding-music-source"
          >
            <ItemMedia>
              <ProviderIcon :domain="source.domain" :size="32" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{{ source.name }}</ItemTitle>
            </ItemContent>
          </Item>
        </ItemGroup>

        <!-- the sources are named up to a point; the rest are counted, so a
             household with a dozen of them still reads as a card -->
        <p
          v-if="moreSources > 0"
          class="text-muted-foreground text-sm"
          data-testid="onboarding-more-sources"
        >
          {{
            $t("onboarding.steps.whats_here.more_count", { count: moreSources })
          }}
        </p>

        <Empty
          v-if="sources.length === 0"
          class="border-border rounded-md border border-dashed py-6"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Music />
            </EmptyMedia>
            <EmptyTitle>
              {{ $t("onboarding.steps.whats_here.listen.empty") }}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>

        <div v-else>
          <Button
            variant="secondary"
            data-testid="onboarding-browse"
            @click="router.push({ name: 'browse' })"
          >
            {{ $t("onboarding.steps.whats_here.listen.browse") }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>
          {{ $t("onboarding.steps.whats_here.players.title") }}
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <ItemGroup v-if="players.length > 0" class="gap-2">
          <Item
            v-for="player in listedPlayers"
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

        <p
          v-if="morePlayers > 0"
          class="text-muted-foreground text-sm"
          data-testid="onboarding-more-players"
        >
          {{
            $t("onboarding.steps.whats_here.more_count", { count: morePlayers })
          }}
        </p>

        <Empty
          v-if="players.length === 0"
          class="border-border rounded-md border border-dashed py-6"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Speaker />
            </EmptyMedia>
            <EmptyTitle>
              {{ $t("onboarding.steps.whats_here.players.empty") }}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>

        <!-- there is nothing to set up here: what a member needs is where the
             players are picked and what playing to one looks like -->
        <p v-else class="text-muted-foreground text-sm">
          {{ $t("onboarding.steps.whats_here.players.hint") }}
        </p>
      </CardContent>
    </Card>
  </section>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { OnboardingStepId } from "@/helpers/onboarding";
import { playerVisible } from "@/helpers/players";
import { api } from "@/plugins/api";
import { ProviderType } from "@/plugins/api/interfaces";
import { Music, Speaker } from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

// how many are named before the rest are only counted
const NAMED_LIMIT = 6;

const router = useRouter();

/**
 * What this member can listen to: the music providers that are running, which
 * the server already filters down to the sources they have access to. The
 * configurations behind them are an admin's business and are never read here.
 * A provider that ships with the server is not a source anyone chose.
 */
const sources = computed(() =>
  Object.values(api.providers)
    .filter(
      (provider) =>
        provider.type === ProviderType.MUSIC &&
        api.providerManifests[provider.domain]?.builtin !== true,
    )
    .map((provider) => ({
      instance_id: provider.instance_id,
      domain: provider.domain,
      name:
        provider.name ||
        api.providerManifests[provider.domain]?.name ||
        provider.domain,
    }))
    .sort((one, other) => one.name.localeCompare(other.name)),
);

/** The players this member may play to, as the player pickers list them. */
const players = computed(() =>
  Object.values(api.players)
    .filter((player) => playerVisible(player))
    .sort((one, other) => one.name.localeCompare(other.name)),
);

const listedSources = computed(() => sources.value.slice(0, NAMED_LIMIT));
const moreSources = computed(
  () => sources.value.length - listedSources.value.length,
);
const listedPlayers = computed(() => players.value.slice(0, NAMED_LIMIT));
const morePlayers = computed(
  () => players.value.length - listedPlayers.value.length,
);
</script>
