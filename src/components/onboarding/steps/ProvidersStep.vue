<template>
  <div>
    <OnboardingInvitation :features="features" :set-up="configured.length > 0">
      <OnboardingList>
        <OnboardingAddRow
          :label="$t(addLabelKey)"
          data-testid="onboarding-add-provider"
          @click="showAddProviderDialog = true"
        />
        <ConfiguredProviderItem
          v-for="provider in shown"
          :key="provider.instance_id"
          :provider="provider"
          data-testid="onboarding-configured-provider"
        />
        <!-- the list takes list items only, so the button gets one of its own -->
        <div v-if="sorted.length > COLLAPSED_COUNT" role="listitem">
          <Button
            variant="ghost"
            class="text-muted-foreground w-full rounded-none"
            data-testid="onboarding-show-all-providers"
            :aria-expanded="showAll"
            @click="showAll = !showAll"
          >
            {{
              showAll
                ? $t("show_less")
                : $t("onboarding.show_all", { count: configured.length })
            }}
          </Button>
        </div>
      </OnboardingList>
    </OnboardingInvitation>

    <AddProviderDialog
      v-model:show="showAddProviderDialog"
      :provider-type="providerType"
      :audio-source-only="connectingApps"
    />
  </div>
</template>

<script setup lang="ts">
import ConfiguredProviderItem from "@/components/onboarding/ConfiguredProviderItem.vue";
import OnboardingAddRow from "@/components/onboarding/OnboardingAddRow.vue";
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import OnboardingList from "@/components/onboarding/OnboardingList.vue";
import { Button } from "@/components/ui/button";
import {
  configuredAudioSourcePlugins,
  configuredProviders,
} from "@/composables/useOnboarding";
import type { OnboardingStepId, StepPrimaryAction } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import {
  Airplay,
  AudioLines,
  HardDrive,
  Headphones,
  Music2,
  Plus,
  Radio,
} from "@lucide/vue";
import { computed, markRaw, ref, watch } from "vue";

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

// a long list is cut short, with the ones needing attention first so they
// are never the ones hidden
const COLLAPSED_COUNT = 5;
const showAll = ref(false);
const sorted = computed(() =>
  [...configured.value].sort(
    (a, b) => Number(b.needsAttention) - Number(a.needsAttention),
  ),
);
const shown = computed(() =>
  showAll.value ? sorted.value : sorted.value.slice(0, COLLAPSED_COUNT),
);
// one just added would land past the cut, so the whole list opens to show it
watch(
  () => configured.value.length,
  (count, previous) => {
    if (count > previous && count > COLLAPSED_COUNT) showAll.value = true;
  },
);

const addLabelKey = computed(() =>
  connectingApps.value
    ? "onboarding.steps.plugins.connect"
    : "settings.add_music_provider",
);

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
// until one is set up, adding one is the step's main button
const primaryAction = computed<StepPrimaryAction | undefined>(() =>
  configured.value.length > 0
    ? undefined
    : {
        labelKey: addLabelKey.value,
        icon: markRaw(Plus),
        run: () => (showAddProviderDialog.value = true),
      },
);

defineExpose({ primaryAction });
</script>
