<template>
  <div>
    <OnboardingInvitation
      :features="FEATURES"
      :set-up="hasSources"
      :note="hasSources ? undefined : optionalLine"
    >
      <OnboardingList>
        <OnboardingAddRow
          :label="$t('onboarding.steps.own_sources.add')"
          data-testid="onboarding-add-provider"
          @click="showAddProviderDialog = true"
        />
        <Item
          v-for="source in ownedMusicSources"
          :key="source.instance_id"
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
      </OnboardingList>
    </OnboardingInvitation>

    <AddProviderDialog
      v-model:show="showAddProviderDialog"
      :provider-type="ProviderType.MUSIC"
      :multi-instance-only="true"
      :self-service-only="true"
    />
  </div>
</template>

<script setup lang="ts">
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import OnboardingAddRow from "@/components/onboarding/OnboardingAddRow.vue";
import OnboardingList from "@/components/onboarding/OnboardingList.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingStepId, StepPrimaryAction } from "@/helpers/onboarding";
import { providerDisplayName } from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import { ProviderType, type ProviderConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import { Headphones, ListMusic, Plus } from "@lucide/vue";
import { computed, markRaw, ref } from "vue";

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

// until they own one, adding one is the step's main button
const primaryAction = computed<StepPrimaryAction | undefined>(() =>
  hasSources.value
    ? undefined
    : {
        labelKey: "onboarding.steps.own_sources.add",
        icon: markRaw(Plus),
        run: () => (showAddProviderDialog.value = true),
      },
);

defineExpose({ primaryAction });
</script>
