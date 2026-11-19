<template>
  <OnboardingInvitation
    :intro="$t('onboarding.steps.ai.intro')"
    :features="FEATURES"
    :features-title="$t('onboarding.steps.ai.examples')"
    :set-up="hasServices"
    :linked="linked"
    :optional="optionalLine"
  >
    <template #partner>
      <Sparkles />
    </template>

    <ItemGroup v-if="hasServices" class="gap-2">
      <ConfiguredProviderItem
        v-for="service in services"
        :key="service.provider.instance_id"
        :provider="service.provider"
        :description="service.provides"
        data-testid="onboarding-ai-service"
      />
    </ItemGroup>

    <!-- the invitation while nothing is set up, a way to add another after -->
    <Button
      :variant="hasServices ? 'secondary' : 'default'"
      :size="hasServices ? 'default' : 'lg'"
      class="self-center"
      data-testid="onboarding-add-ai-service"
      @click="showAddDialog = true"
    >
      <Plus class="size-4" />
      {{ $t("settings.ai.add_service") }}
    </Button>

    <AddProviderDialog
      v-model:show="showAddDialog"
      :provider-type="ProviderType.PLUGIN"
      ai-service-only
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
import { useAIEngines } from "@/composables/settings/useAIEngines";
import { configuredAIServices } from "@/composables/useOnboarding";
import { enginesOf } from "@/helpers/ai_engines";
import { engineSummary } from "@/helpers/ai_settings";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import {
  Image,
  Megaphone,
  MicVocal,
  Plus,
  Radio,
  Sparkles,
  WandSparkles,
} from "@lucide/vue";
import { computed, ref } from "vue";

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
const linked = computed(() =>
  services.value.some(({ provider }) => !provider.needsAttention),
);
const optionalLine = computed(() =>
  $t("onboarding.steps.ai.optional", { ai: $t("settings.ai.title") }),
);
</script>
