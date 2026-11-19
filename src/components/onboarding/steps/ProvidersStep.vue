<template>
  <OnboardingInvitation
    :intro="$t(descriptionKey)"
    :features="features"
    :set-up="configured.length > 0"
    :linked="linked"
  >
    <template #partner>
      <component :is="icon" />
    </template>

    <ItemGroup v-if="configured.length > 0" class="gap-2">
      <ConfiguredProviderItem
        v-for="provider in configured"
        :key="provider.instance_id"
        :provider="provider"
        data-testid="onboarding-configured-provider"
      />
    </ItemGroup>

    <!-- the invitation while nothing is set up, a way to add another after -->
    <Button
      :variant="configured.length > 0 ? 'secondary' : 'default'"
      :size="configured.length > 0 ? 'default' : 'lg'"
      class="self-center"
      data-testid="onboarding-add-provider"
      @click="showAddProviderDialog = true"
    >
      <Plus class="size-4" />
      {{ $t(addLabelKey) }}
    </Button>

    <AddProviderDialog
      v-model:show="showAddProviderDialog"
      :provider-type="providerType"
      :audio-source-only="connectingApps"
    />
  </OnboardingInvitation>
</template>

<script setup lang="ts">
import ConfiguredProviderItem from "@/components/onboarding/ConfiguredProviderItem.vue";
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import {
  configuredAudioSourcePlugins,
  configuredProviders,
} from "@/composables/useOnboarding";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import {
  Airplay,
  AudioLines,
  HardDrive,
  Headphones,
  Music,
  Music2,
  Plus,
  Radio,
  Smartphone,
} from "@lucide/vue";
import { computed, markRaw, ref } from "vue";

const props = defineProps<{
  providerType: ProviderType;
}>();

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const showAddProviderDialog = ref(false);
// the players have a step of their own, so this one is the music sources or
// the plugins that let the music apps play to Music Assistant
const connectingApps = computed(
  () => props.providerType === ProviderType.PLUGIN,
);

const configured = computed(() =>
  connectingApps.value
    ? configuredAudioSourcePlugins()
    : configuredProviders(props.providerType),
);

const descriptionKey = computed(() =>
  connectingApps.value
    ? "onboarding.steps.plugins.phone_apps_instructions"
    : "onboarding.steps.music_sources.description",
);

const addLabelKey = computed(() =>
  connectingApps.value
    ? "onboarding.steps.plugins.connect"
    : "settings.add_music_provider",
);

const icon = computed(() => markRaw(connectingApps.value ? Smartphone : Music));

const MUSIC_SOURCE_FEATURES: readonly InvitationFeature[] = [
  {
    icon: Headphones,
    labelKey: "onboarding.steps.music_sources.features.streaming",
  },
  {
    icon: HardDrive,
    labelKey: "onboarding.steps.music_sources.features.files",
  },
  { icon: Radio, labelKey: "onboarding.steps.music_sources.features.radio" },
];
const MUSIC_APP_FEATURES: readonly InvitationFeature[] = [
  { icon: Music2, labelKey: "onboarding.steps.plugins.features.apps" },
  {
    icon: AudioLines,
    labelKey: "onboarding.steps.plugins.features.spotify_connect",
  },
  { icon: Airplay, labelKey: "onboarding.steps.plugins.features.airplay" },
];

const features = computed(() =>
  connectingApps.value ? MUSIC_APP_FEATURES : MUSIC_SOURCE_FEATURES,
);
const linked = computed(() =>
  configured.value.some((provider) => !provider.needsAttention),
);
</script>
