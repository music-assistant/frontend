<template>
  <div>
    <!-- with nothing set up and nothing found yet, the step invites to add
         player support; after that it follows what turns up -->
    <OnboardingInvitation :features="FEATURES" :set-up="!inviting">
      <!-- room for the players discovery usually finds, so the heading above
           stays put while they turn up -->
      <div class="min-h-64">
        <!-- a live region so a player that was just found is announced -->
        <OnboardingList aria-live="polite">
          <!-- the picker adds a provider either way; only where nothing is set
             up yet is it named -->
          <OnboardingAddRow
            :label="
              providers.length > 0
                ? $t('onboarding.steps.players.add_more')
                : $t('settings.add_player_provider')
            "
            data-testid="onboarding-add-provider"
            @click="showAddProviderDialog = true"
          />
          <DiscoveredPlayerItem
            v-for="player in players"
            :key="player.player_id"
            :player="player"
            :can-edit="canEdit"
          />
          <!-- a provider that is running is still looking, and the list shows
             that rather than an emptiness that reads as final -->
          <OnboardingPlaceholderRow
            v-if="players.length === 0"
            :icon="Speaker"
            :looking="discovering"
            :title="$t('onboarding.steps.players.empty')"
            :description="
              discovering
                ? $t('onboarding.steps.players.discovering_hint')
                : $t('onboarding.steps.players.no_provider_hint')
            "
            :data-testid="
              discovering
                ? 'onboarding-players-discovering'
                : 'onboarding-players-empty'
            "
          />
        </OnboardingList>
      </div>
    </OnboardingInvitation>

    <!-- the player providers that are set up, so what "add more" adds to is in
         view, and a provider that found nothing yet still shows for its work -->
    <p
      v-if="!inviting && providers.length > 0"
      class="text-muted-foreground mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs"
    >
      <span>{{ $t("onboarding.steps.players.discovered_by") }}</span>
      <span
        v-for="provider in providers"
        :key="provider.instance_id"
        class="text-foreground inline-flex items-center gap-1"
        data-testid="onboarding-player-provider"
      >
        <ProviderIcon :domain="provider.domain" :size="14" aria-hidden="true" />
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

    <AddProviderDialog
      v-model:show="showAddProviderDialog"
      :provider-type="ProviderType.PLAYER"
    />
  </div>
</template>

<script setup lang="ts">
import DiscoveredPlayerItem from "@/components/onboarding/DiscoveredPlayerItem.vue";
import OnboardingAddRow from "@/components/onboarding/OnboardingAddRow.vue";
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import OnboardingList from "@/components/onboarding/OnboardingList.vue";
import OnboardingPlaceholderRow from "@/components/onboarding/OnboardingPlaceholderRow.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  configuredProviders,
  discoveredPlayers,
} from "@/composables/useOnboarding";
import {
  attentionLabelKey,
  type OnboardingStepId,
  type StepPrimaryAction,
} from "@/helpers/onboarding";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import { Group, Play, Plus, Radar, Speaker, TriangleAlert } from "@lucide/vue";
import { computed, markRaw, ref } from "vue";

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

const inviting = computed(
  () => providers.value.length === 0 && players.value.length === 0,
);

const FEATURES: readonly InvitationFeature[] = [
  {
    icon: Radar,
    labelKey: "onboarding.steps.players.features.found_automatically",
  },
  { icon: Play, labelKey: "onboarding.steps.players.features.one_place" },
  { icon: Group, labelKey: "onboarding.steps.players.features.groups" },
];

const showAddProviderDialog = ref(false);

// with nothing set up and nothing found yet, adding player support is the
// step's main button
const primaryAction = computed<StepPrimaryAction | undefined>(() =>
  inviting.value
    ? {
        labelKey: "settings.add_player_provider",
        icon: markRaw(Plus),
        run: () => (showAddProviderDialog.value = true),
      }
    : undefined,
);

defineExpose({ primaryAction });
</script>
