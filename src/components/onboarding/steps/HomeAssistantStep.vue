<template>
  <section class="flex min-h-0 flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.home_assistant.description") }}
    </p>

    <ConfiguredProviderItem
      v-if="connection"
      :provider="connection"
      data-testid="onboarding-home-assistant-connection"
    />

    <div v-else>
      <Button data-testid="onboarding-home-assistant-connect" @click="connect">
        <Plug class="size-4" />
        {{ $t("onboarding.steps.home_assistant.connect") }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import ConfiguredProviderItem from "@/components/onboarding/ConfiguredProviderItem.vue";
import { Button } from "@/components/ui/button";
import { configuredProviders } from "@/composables/useOnboarding";
import { HASS_DOMAIN } from "@/helpers/hass_controls";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { Plug } from "@lucide/vue";
import { computed } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const connection = computed(() =>
  configuredProviders(ProviderType.PLUGIN).find(
    (provider) => provider.domain === HASS_DOMAIN,
  ),
);

const connect = function () {
  eventbus.emit("setupFlowDialog", { kind: "provider", domain: HASS_DOMAIN });
};
</script>
