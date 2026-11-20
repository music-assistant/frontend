<template>
  <div>
    <OnboardingInvitation
      :features="FEATURES"
      :set-up="hasServices"
      :note="hasServices ? undefined : optionalLine"
    >
      <OnboardingList>
        <!-- what a service does for AI is set on the AI settings page, so its
             row here only shows how it is doing -->
        <ConfiguredProviderItem
          v-for="service in services"
          :key="service.provider.instance_id"
          :provider="service.provider"
          :description="service.provides"
          status-only
          data-testid="onboarding-ai-service"
        />
        <OnboardingAddRow
          :label="$t('settings.ai.add_service')"
          data-testid="onboarding-add-ai-service"
          @click="showAddDialog = true"
        />
      </OnboardingList>
    </OnboardingInvitation>

    <AddProviderDialog
      v-model:show="showAddDialog"
      :provider-type="ProviderType.PLUGIN"
      ai-service-only
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
import { useAIEngines } from "@/composables/settings/useAIEngines";
import { configuredAIServices } from "@/composables/useOnboarding";
import { enginesOf } from "@/helpers/ai_engines";
import { engineSummary } from "@/helpers/ai_settings";
import type { OnboardingStepId, StepPrimaryAction } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import {
  Image,
  Megaphone,
  MicVocal,
  Plus,
  Radio,
  WandSparkles,
} from "@lucide/vue";
import { computed, markRaw, ref } from "vue";

/**
 * The invitation to add AI: a few things it brings, the AI services set up,
 * each with what it provides, and a way to add one. The defaults are left to
 * the server and the AI page.
 */

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const FEATURES: readonly InvitationFeature[] = [
  { icon: Megaphone, labelKey: "onboarding.steps.ai.features.announcements" },
  { icon: Radio, labelKey: "onboarding.steps.ai.features.ai_radio" },
  {
    icon: WandSparkles,
    labelKey: "onboarding.steps.ai.features.smart_playlists",
  },
  { icon: MicVocal, labelKey: "onboarding.steps.ai.features.music_quiz" },
  { icon: Image, labelKey: "onboarding.steps.ai.features.playlist_covers" },
];

const showAddDialog = ref(false);

const { engines } = useAIEngines();

const services = computed(() =>
  configuredAIServices().map((provider) => ({
    provider,
    provides: engineSummary(enginesOf(engines.value, provider.instance_id)),
  })),
);

const hasServices = computed(() => services.value.length > 0);
const optionalLine = computed(() =>
  $t("onboarding.steps.ai.optional", { ai: $t("settings.ai.title") }),
);

// until a service is set up, adding one is the step's main button
const primaryAction = computed<StepPrimaryAction | undefined>(() =>
  hasServices.value
    ? undefined
    : {
        labelKey: "settings.ai.add_service",
        icon: markRaw(Plus),
        run: () => (showAddDialog.value = true),
      },
);

defineExpose({ primaryAction });
</script>
