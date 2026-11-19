<template>
  <section class="flex min-h-0 flex-col gap-4">
    <p class="text-muted-foreground text-sm">{{ $t(descriptionKey) }}</p>

    <ScrollFade>
      <ItemGroup v-if="configured.length > 0" class="gap-2">
        <ConfiguredProviderItem
          v-for="provider in configured"
          :key="provider.instance_id"
          :provider="provider"
          data-testid="onboarding-configured-provider"
        />
      </ItemGroup>

      <Empty v-else class="border-border rounded-md border border-dashed py-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <component :is="icon" />
          </EmptyMedia>
          <EmptyTitle>{{ $t("onboarding.nothing_configured") }}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    </ScrollFade>

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
      :audio-source-only="connectingApps"
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
import {
  configuredAudioSourcePlugins,
  configuredProviders,
} from "@/composables/useOnboarding";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import AddProviderDialog from "@/views/settings/AddProviderDialog.vue";
import { Music, Plus, Smartphone } from "@lucide/vue";
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
    ? "onboarding.steps.plugins.phone_apps_description"
    : "onboarding.steps.music_sources.description",
);

const addLabelKey = computed(() =>
  connectingApps.value
    ? "onboarding.steps.plugins.connect"
    : "settings.add_music_provider",
);

const icon = computed(() => markRaw(connectingApps.value ? Smartphone : Music));
</script>
