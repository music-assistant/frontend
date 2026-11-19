<template>
  <section class="flex flex-col gap-5">
    <p
      class="text-muted-foreground text-sm"
      data-testid="onboarding-remote-access-intro"
    >
      {{ $t(introKey) }}
    </p>

    <div v-if="canManageRemoteAccess" class="flex flex-col gap-3">
      <RemoteAccessCard />
      <p
        v-if="homeAssistantConnected"
        class="text-muted-foreground text-sm"
        data-testid="onboarding-remote-access-home-assistant"
      >
        {{ $t("onboarding.steps.core_settings.remote.home_assistant") }}
      </p>
    </div>

    <p
      class="text-muted-foreground text-sm"
      data-testid="onboarding-network-hint"
    >
      {{
        $t("onboarding.steps.core_settings.network_hint", {
          system: $t("settings.system"),
          network: $t("settings.network.title"),
        })
      }}
    </p>
  </section>
</template>

<script setup lang="ts">
import RemoteAccessCard from "@/components/onboarding/RemoteAccessCard.vue";
import { useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { computed } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { ctx } = useOnboarding();

// what this admin may do here: a custom role can run the setup without being
// allowed to switch remote access
const canManageRemoteAccess = authManager.hasScope(Scope.SYSTEM_MANAGE);

// the add-on is opened wherever Home Assistant is, so its intro says so
const introKey = computed(() =>
  ctx.value.homeAssistantAddon
    ? "onboarding.steps.core_settings.intro_addon"
    : "onboarding.steps.core_settings.away_intro",
);
// the server routes remote access through Home Assistant Link by itself
// whenever the Home Assistant it is connected to has it
const homeAssistantConnected = computed(
  () => ctx.value.homeAssistantAddon || ctx.value.homeAssistantConfigured,
);
</script>
