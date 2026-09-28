<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.own_sources.description") }}
    </p>

    <!-- fixed minimum height so the step does not jump once configs load -->
    <div class="min-h-24">
      <div v-if="ownedMusicSources.length > 0" class="flex flex-col gap-2">
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
            <ItemMedia>
              <ProviderIcon :domain="source.domain" :size="32" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{{ sourceName(source) }}</ItemTitle>
            </ItemContent>
          </Item>
        </ItemGroup>
      </div>

      <Empty v-else class="border-border rounded-md border border-dashed py-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Music />
          </EmptyMedia>
          <EmptyTitle>{{
            $t("onboarding.steps.own_sources.empty")
          }}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    </div>

    <div>
      <Button
        :variant="ownedMusicSources.length > 0 ? 'secondary' : 'default'"
        data-testid="onboarding-add-provider"
        @click="showAddProviderDialog = true"
      >
        <Plus class="size-4" />
        {{ $t("onboarding.steps.own_sources.add") }}
      </Button>
    </div>

    <AddProviderDialog
      v-model:show="showAddProviderDialog"
      :provider-type="ProviderType.MUSIC"
      :multi-instance-only="true"
      :self-service-only="true"
    />
  </section>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import { Music, Plus } from "@lucide/vue";
import { ref } from "vue";

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

const sourceName = (config: ProviderConfig) =>
  providerDisplayName(
    config,
    api.providers[config.instance_id],
    api.providerManifests[config.domain],
  ) || config.domain;
</script>
