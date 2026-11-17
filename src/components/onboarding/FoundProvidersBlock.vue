<template>
  <div
    v-if="found.length > 0"
    class="flex flex-col gap-3"
    data-testid="onboarding-found-providers"
  >
    <div class="flex flex-col gap-1">
      <h3 class="text-sm font-semibold">
        {{ $t("settings.catalog.discovered_title") }}
      </h3>
      <p class="text-muted-foreground text-sm">
        {{ $t("onboarding.steps.players.found_description") }}
      </p>
    </div>

    <ItemGroup class="gap-2">
      <Item
        v-for="manifest in found"
        :key="manifest.domain"
        as="label"
        variant="outline"
        size="sm"
        class="flex-nowrap"
        data-testid="onboarding-found-provider"
      >
        <ItemMedia variant="icon">
          <ProviderIcon
            :domain="manifest.domain"
            :size="20"
            aria-hidden="true"
          />
        </ItemMedia>
        <ItemContent class="min-w-0">
          <ItemTitle>{{ manifest.name }}</ItemTitle>
          <ItemDescription v-if="manifest.description">
            {{ manifest.description }}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Checkbox
            :model-value="selected.has(manifest.domain)"
            :disabled="busy"
            :aria-label="
              $t('settings.catalog.add_named', { name: manifest.name })
            "
            data-testid="onboarding-found-provider-select"
            @update:model-value="select(manifest.domain, $event === true)"
          />
        </ItemActions>
      </Item>
    </ItemGroup>

    <div>
      <Button
        variant="secondary"
        :disabled="busy || selected.size === 0"
        data-testid="onboarding-found-providers-add"
        @click="addSelected"
      >
        <Spinner v-if="busy" class="size-4" />
        <Plus v-else class="size-4" />
        {{ $t("onboarding.steps.players.add_selected") }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { getFoundPlayerProviders } from "@/helpers/catalog_recommendations";
import { buildCatalogEntries } from "@/helpers/provider_catalog";
import { api } from "@/plugins/api";
import { FlowStepType, type ProviderManifest } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Plus } from "@lucide/vue";
import { onMounted, ref } from "vue";
import { toast } from "vue-sonner";

// the player providers found on the network that the user may add here, and
// the ones of them that are ticked
const found = ref<ProviderManifest[]>([]);
const selected = ref(new Set<string>());
const busy = ref(false);
// the adding in flight, which a second call waits for instead of adding again
let pending: Promise<boolean> | null = null;

/**
 * Add every ticked provider. Resolves to whether all of them were added; one
 * that was not stays listed and ticked.
 */
const addSelected = function (): Promise<boolean> {
  pending ??= addTicked().finally(() => {
    pending = null;
  });
  return pending;
};

defineExpose({ addSelected, busy });

onMounted(load);

async function load(): Promise<void> {
  try {
    const [recommendations, configs] = await Promise.all([
      api.getCatalogRecommendations(),
      api.getProviderConfigs(),
    ]);
    found.value = getFoundPlayerProviders(
      recommendations,
      buildCatalogEntries(Object.values(api.providerManifests), configs),
    );
    selected.value = new Set(found.value.map((manifest) => manifest.domain));
  } catch {
    // without an answer the step offers nothing to add, as before
  }
}

function select(domain: string, ticked: boolean): void {
  const next = new Set(selected.value);
  if (ticked) next.add(domain);
  else next.delete(domain);
  selected.value = next;
}

async function addTicked(): Promise<boolean> {
  const ticked = found.value.filter((manifest) =>
    selected.value.has(manifest.domain),
  );
  if (ticked.length === 0) return true;
  busy.value = true;
  try {
    let allAdded = true;
    for (const manifest of ticked) {
      if (await add(manifest)) {
        found.value = found.value.filter((item) => item !== manifest);
        select(manifest.domain, false);
      } else allAdded = false;
    }
    return allAdded;
  } finally {
    busy.value = false;
  }
}

async function add(manifest: ProviderManifest): Promise<boolean> {
  const name = manifest.name;
  try {
    const step = await api.setupProvider(manifest.domain, {
      suppressGlobalError: true,
    });
    if (step.type === FlowStepType.FINISH) {
      toast.success($t("onboarding.steps.players.provider_added", { name }));
      return true;
    }
  } catch {
    // reported below, the same as a setup that did not finish
  }
  toast.error($t("onboarding.steps.players.provider_add_failed", { name }));
  return false;
}
</script>
