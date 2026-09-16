<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.your_music.description") }}
    </p>

    <template v-if="sources.length > 0">
      <ItemGroup class="gap-2">
        <Item
          v-for="source in listed"
          :key="source.instance_id"
          variant="outline"
          size="sm"
          data-testid="onboarding-music-source"
        >
          <ItemMedia>
            <!-- the name right next to it already says which source it is -->
            <ProviderIcon
              :domain="source.domain"
              :size="32"
              aria-hidden="true"
            />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{{ source.name }}</ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>

      <!-- the sources are named up to a point; the rest are counted, so a
           home with a dozen of them still reads as a short step -->
      <p
        v-if="more > 0"
        class="text-muted-foreground text-sm"
        data-testid="onboarding-more-sources"
      >
        {{ $t("onboarding.more_count", { count: more }) }}
      </p>
    </template>

    <Empty v-else class="border-border rounded-md border border-dashed py-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Music />
        </EmptyMedia>
        <EmptyTitle>{{ $t("onboarding.steps.your_music.empty") }}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  </section>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
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
