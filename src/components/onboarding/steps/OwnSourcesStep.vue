<template>
  <OnboardingInvitation
    :intro="$t('onboarding.steps.own_sources.intro')"
    :features="FEATURES"
    :set-up="hasSources"
    :linked="hasSources"
    :optional="optionalLine"
  >
    <template #partner>
      <Music />
    </template>

    <div v-if="hasSources" class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold">
        {{ $t("onboarding.steps.own_sources.connected") }}
      </h3>
      <ItemGroup class="gap-2">
        <Item
          v-for="source in ownedMusicSources"
          :key="source.instance_id"
          variant="outline"
          size="sm"
          data-testid="onboarding-own-source"
        >
          <ItemMedia variant="icon">
            <ProviderIcon :domain="source.domain" :size="20" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{{ sourceName(source) }}</ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>
    </div>

    <!-- the invitation while they own none, a way to add another after -->
    <Button
      :variant="hasSources ? 'secondary' : 'default'"
      :size="hasSources ? 'default' : 'lg'"
      class="self-center"
      data-testid="onboarding-add-provider"
      @click="showAddProviderDialog = true"
    >
      <Plus class="size-4" />
      {{ $t("onboarding.steps.own_sources.add") }}
    </Button>

    <AddProviderDialog
      v-model:show="showAddProviderDialog"
      :provider-type="ProviderType.MUSIC"
      :multi-instance-only="true"
      :self-service-only="true"
    />
  </OnboardingInvitation>
</template>

<script setup lang="ts">
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { providerDisplayName } from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import { ProviderType, type ProviderConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import { Headphones, ListMusic, Music, Plus } from "@lucide/vue";
import { computed, ref } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

// the dialog + PROVIDERS_UPDATED refresh keeps the list up to date, so the step
// has nothing to save on the way out and needs no beforeLeave
const { ownedMusicSources } = useOnboarding();

const showAddProviderDialog = ref(false);

const FEATURES: readonly InvitationFeature[] = [
  {
    icon: Headphones,
    labelKey: "onboarding.steps.own_sources.features.accounts",
  },
  {
    icon: ListMusic,
    labelKey: "onboarding.steps.own_sources.features.library",
  },
];

const hasSources = computed(() => ownedMusicSources.value.length > 0);
const optionalLine = computed(() =>
  $t("onboarding.steps.own_sources.optional", {
    music: $t("settings.music"),
  }),
);

const sourceName = (config: ProviderConfig) =>
  providerDisplayName(
    config,
    api.providers[config.instance_id],
    api.providerManifests[config.domain],
  ) || config.domain;
</script>
