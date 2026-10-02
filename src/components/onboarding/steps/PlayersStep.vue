<template>
  <section class="flex min-h-0 flex-col gap-4">
    <!-- with players to act on, the description says what can be done to
         them; without, it says what finds them -->
    <p class="text-muted-foreground text-sm">
      {{
        players.length > 0
          ? $t("onboarding.steps.players.description")
          : $t("onboarding.steps.players.description_empty")
      }}
    </p>

    <!-- the player providers that are set up, so what "add more" adds to is in
         view, and a provider that found nothing yet still shows for its work -->
    <p
      v-if="providers.length > 0"
      class="text-muted-foreground flex flex-wrap items-center gap-y-1 text-sm"
    >
      <span class="pr-3">{{
        $t("onboarding.steps.players.discovered_by")
      }}</span>
      <span
        v-for="(provider, index) in providers"
        :key="provider.instance_id"
        class="text-foreground inline-flex items-center gap-1.5 px-3 first:pl-0 last:pr-0"
        :class="{ 'border-border border-r': index < providers.length - 1 }"
        data-testid="onboarding-player-provider"
      >
        <ProviderIcon :domain="provider.domain" :size="16" aria-hidden="true" />
        {{ provider.name }}
        <!-- a provider that is set up but switched off or broken is flagged -->
        <span
          v-if="provider.needsAttention"
          :title="$t(attentionLabelKey(provider.status))"
        >
          <TriangleAlert
            class="text-muted-foreground size-3.5"
            :aria-label="$t(attentionLabelKey(provider.status))"
          />
        </span>
      </span>
    </p>

    <!-- a minimum height the empty state fits in, so the step does not jump
         as the first players turn up, and a live region so a player that was
         just found is announced -->
    <ScrollFade class="min-h-40" aria-live="polite">
      <ItemGroup v-if="players.length > 0" class="gap-2">
        <DiscoveredPlayerItem
          v-for="player in players"
          :key="player.player_id"
          :player="player"
          :can-edit="canEdit"
        />
      </ItemGroup>

      <Empty v-else class="border-border rounded-md border border-dashed py-6">
        <EmptyHeader>
          <!-- a provider that is running is still looking, and the step shows
               that rather than an empty list that reads as final -->
          <EmptyMedia variant="icon">
            <Spinner
              v-if="discovering"
              class="size-5"
              data-testid="onboarding-players-discovering"
            />
            <Speaker v-else />
          </EmptyMedia>
          <EmptyTitle>{{ $t("onboarding.steps.players.empty") }}</EmptyTitle>
          <!-- with nothing looking, adding a provider is the way to players;
               with one at work, all there is to do is wait for it -->
          <EmptyDescription>
            {{
              discovering
                ? $t("onboarding.steps.players.discovering_hint")
                : $t("onboarding.steps.players.no_provider_hint")
            }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </ScrollFade>

    <!-- the picker adds a provider either way; only where nothing is set up
         yet, and the hint above has just said what a provider is, is it named -->
    <div>
      <Button
        :variant="providers.length > 0 ? 'secondary' : 'default'"
        data-testid="onboarding-add-provider"
        @click="showAddProviderDialog = true"
      >
        <Plus class="size-4" />
        {{
          providers.length > 0
            ? $t("onboarding.steps.players.add_more")
            : $t("settings.add_player_provider")
        }}
      </Button>
    </div>

    <AddProviderDialog
      v-model:show="showAddProviderDialog"
      :provider-type="ProviderType.PLAYER"
    />
  </section>
</template>

<script setup lang="ts">
import DiscoveredPlayerItem from "@/components/onboarding/DiscoveredPlayerItem.vue";
import ScrollFade from "@/components/onboarding/ScrollFade.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import {
  configuredProviders,
  discoveredPlayers,
} from "@/composables/useOnboarding";
import { attentionLabelKey, type OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import { Plus, Speaker, TriangleAlert } from "@lucide/vue";
import { computed, ref } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

// the wizard keeps both lists up to date while it is open, so the step has
// nothing to save on the way out and needs no beforeLeave
const providers = computed(() => configuredProviders(ProviderType.PLAYER));
const players = computed(() => discoveredPlayers());
// whether anything is looking for players: a provider that is switched off
// or failed to load finds nothing
const discovering = computed(() =>
  providers.value.some((provider) => !provider.needsAttention),
);
// switching a player on or off and renaming it are player configuration
// writes, which the admin track does not imply
const canEdit = computed(() =>
  authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE),
);

const showAddProviderDialog = ref(false);
</script>
