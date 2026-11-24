<template>
  <OnboardingList>
    <template v-if="sources.length > 0">
      <Item
        v-for="source in listed"
        :key="source.instance_id"
        size="sm"
        data-testid="onboarding-music-source"
      >
        <ItemMedia variant="icon">
          <!-- the name right next to it already says which source it is -->
          <ProviderIcon :domain="source.domain" :size="20" aria-hidden="true" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ source.name }}</ItemTitle>
        </ItemContent>
      </Item>

      <!-- the sources are named up to a point; the rest are counted, so a
           home with a dozen of them still reads as a short step -->
      <Item v-if="more > 0" size="sm" data-testid="onboarding-more-sources">
        <ItemMedia class="size-8" />
        <ItemContent class="text-muted-foreground text-sm">
          {{ $t("onboarding.more_count", { count: more }) }}
        </ItemContent>
      </Item>
    </template>

    <OnboardingPlaceholderRow
      v-else
      :icon="Music"
      :title="$t('onboarding.steps.your_music.empty')"
    />
  </OnboardingList>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import OnboardingList from "@/components/onboarding/OnboardingList.vue";
import OnboardingPlaceholderRow from "@/components/onboarding/OnboardingPlaceholderRow.vue";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { isBuiltinProvider } from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import { ProviderType } from "@/plugins/api/interfaces";
import { Music } from "@lucide/vue";
import { computed } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

// how many are named before the rest are only counted
const NAMED_LIMIT = 6;

/**
 * What this member can listen to: the music providers that are running, which
 * the server already filters down to the sources they have access to. The
 * configurations behind them are an admin's business and are never read here.
 * A provider that ships with the server is not a source anyone chose, and one
 * that is not available is nothing to listen to right now.
 */
const sources = computed(() =>
  Object.values(api.providers)
    .filter(
      (provider) =>
        provider.type === ProviderType.MUSIC &&
        provider.available &&
        !isBuiltinProvider(api.providerManifests[provider.domain]),
    )
    .map((provider) => ({
      instance_id: provider.instance_id,
      domain: provider.domain,
      name:
        provider.name ||
        api.providerManifests[provider.domain]?.name ||
        provider.domain,
    }))
    .sort((one, other) => one.name.localeCompare(other.name)),
);

const listed = computed(() => sources.value.slice(0, NAMED_LIMIT));
const more = computed(() => sources.value.length - listed.value.length);
</script>
