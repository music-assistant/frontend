<template>
  <section class="flex min-h-0 flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.ai.description") }}
    </p>

    <ScrollFade>
      <ItemGroup v-if="services.length > 0" class="gap-2">
        <ConfiguredProviderItem
          v-for="service in services"
          :key="service.provider.instance_id"
          :provider="service.provider"
          :description="service.provides"
          data-testid="onboarding-ai-service"
        />
      </ItemGroup>

      <Empty v-else class="border-border rounded-md border border-dashed py-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Sparkles />
          </EmptyMedia>
          <EmptyTitle>{{ $t("onboarding.nothing_configured") }}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    </ScrollFade>

    <div>
      <Button
        :variant="services.length > 0 ? 'secondary' : 'default'"
        data-testid="onboarding-add-ai-service"
        @click="showAddDialog = true"
      >
        <Plus class="size-4" />
        {{ $t("settings.ai.add_service") }}
      </Button>
    </div>

    <AddProviderDialog
      v-model:show="showAddDialog"
      :provider-type="ProviderType.PLUGIN"
      ai-service-only
    />
  </section>
</template>

<script setup lang="ts">
import ConfiguredProviderItem from "@/components/onboarding/ConfiguredProviderItem.vue";
import ScrollFade from "@/components/onboarding/ScrollFade.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { useAIEngines } from "@/composables/settings/useAIEngines";
import { configuredAIServices } from "@/composables/useOnboarding";
import { enginesOf } from "@/helpers/ai_engines";
import { engineSummary } from "@/helpers/ai_settings";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import { Plus, Sparkles } from "@lucide/vue";
import { computed, ref } from "vue";

/**
 * The invitation to add AI: the AI services set up, each with what it
 * provides, and a way to add another. The defaults are left to the server and
 * the AI page.
 */

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const showAddDialog = ref(false);

const { engines } = useAIEngines();

const services = computed(() =>
  configuredAIServices().map((provider) => ({
    provider,
    provides: engineSummary(enginesOf(engines.value, provider.instance_id)),
  })),
);
</script>
