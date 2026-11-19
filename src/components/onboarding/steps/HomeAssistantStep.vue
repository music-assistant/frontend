<template>
  <OnboardingInvitation
    :intro="$t('onboarding.steps.home_assistant.intro')"
    :features="FEATURES"
    :set-up="!!connection"
    :linked="connection && !connection.needsAttention"
    :optional="optionalLine"
  >
    <template #partner>
      <ProviderIcon :domain="HASS_DOMAIN" :size="32" />
    </template>

    <ConfiguredProviderItem
      v-if="connection"
      :provider="connection"
      data-testid="onboarding-home-assistant-connection"
    />

    <Button
      v-else
      size="lg"
      class="self-center"
      data-testid="onboarding-home-assistant-connect"
      @click="connect"
    >
      <Plug class="size-4" />
      {{ $t("onboarding.steps.home_assistant.connect") }}
    </Button>
  </OnboardingInvitation>
</template>

<script setup lang="ts">
import ConfiguredProviderItem from "@/components/onboarding/ConfiguredProviderItem.vue";
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { configuredProviders } from "@/composables/useOnboarding";
import { HASS_DOMAIN } from "@/helpers/home_assistant";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { CloudCog, LogIn, Plug, SlidersHorizontal, Speaker } from "@lucide/vue";
import { computed } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const FEATURES: readonly InvitationFeature[] = [
  {
    icon: Speaker,
    labelKey: "onboarding.steps.home_assistant.features.players",
  },
  {
    icon: SlidersHorizontal,
    labelKey: "onboarding.steps.home_assistant.features.controls",
  },
  {
    icon: LogIn,
    labelKey: "onboarding.steps.home_assistant.features.sign_in",
  },
  {
    icon: CloudCog,
    labelKey: "onboarding.steps.home_assistant.features.remote_access",
  },
];

const connection = computed(() =>
  configuredProviders(ProviderType.PLUGIN).find(
    (provider) => provider.domain === HASS_DOMAIN,
  ),
);

const optionalLine = computed(() =>
  $t("onboarding.steps.home_assistant.optional", {
    system: $t("settings.system"),
    home_assistant: $t("settings.home_assistant.title"),
  }),
);

const connect = function () {
  eventbus.emit("setupFlowDialog", { kind: "provider", domain: HASS_DOMAIN });
};
</script>
