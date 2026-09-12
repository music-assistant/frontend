<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">{{ $t(descriptionKey) }}</p>

    <!-- fixed minimum height so the step does not jump once providers load -->
    <div class="min-h-24">
      <ItemGroup v-if="configured.length > 0" class="gap-2">
        <Item
          v-for="provider in configured"
          :key="provider.instance_id"
          variant="outline"
          size="sm"
          data-testid="onboarding-configured-provider"
        >
          <ItemMedia>
            <ProviderIcon :domain="provider.domain" :size="32" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{{ provider.name }}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <!-- a provider that is set up but switched off or broken is no tick -->
            <Check
              v-if="!provider.needsAttention"
              class="text-primary size-4"
              aria-hidden="true"
            />
            <TriangleAlert
              v-else
              class="text-muted-foreground size-4"
              :aria-label="$t('onboarding.needs_attention')"
              :title="$t('onboarding.needs_attention')"
            />
          </ItemActions>
        </Item>
      </ItemGroup>

      <Empty v-else class="border-border rounded-md border border-dashed py-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <component :is="icon" />
          </EmptyMedia>
          <EmptyTitle>{{ $t("onboarding.nothing_configured") }}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    </div>

    <div>
      <Button
        :variant="configured.length > 0 ? 'secondary' : 'default'"
        data-testid="onboarding-add-provider"
        @click="showAddProviderDialog = true"
      >
        <Plus class="size-4" />
        {{ $t(addLabelKey) }}
      </Button>
    </div>

    <AddProviderDialog
      v-model:show="showAddProviderDialog"
      :provider-type="providerType"
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
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { configuredProviders } from "@/composables/useOnboarding";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import {
  Check,
  Music,
  Plus,
  Puzzle,
  Speaker,
  TriangleAlert,
} from "@lucide/vue";
import { match } from "ts-pattern";
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

const configured = computed(() => configuredProviders(props.providerType));

const descriptionKey = computed(() =>
  match(props.providerType)
    .with(ProviderType.PLAYER, () => "onboarding.steps.players.description")
    .with(ProviderType.PLUGIN, () => "onboarding.steps.plugins.description")
    .otherwise(() => "onboarding.steps.music_sources.description"),
);

const addLabelKey = computed(() =>
  match(props.providerType)
    .with(ProviderType.PLAYER, () => "settings.add_player_provider")
    .with(ProviderType.PLUGIN, () => "settings.add_plugin_provider")
    .otherwise(() => "settings.add_music_provider"),
);

const icon = computed(() =>
  match(props.providerType)
    .with(ProviderType.PLAYER, () => markRaw(Speaker))
    .with(ProviderType.PLUGIN, () => markRaw(Puzzle))
    .otherwise(() => markRaw(Music)),
);
</script>
