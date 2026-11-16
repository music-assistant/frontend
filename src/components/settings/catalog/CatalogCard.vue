<template>
  <CatalogBannerCard
    :domain="entry.manifest.domain"
    :icon="entry.community?.icon"
    :name="entry.manifest.name"
    openable
    data-testid="catalog-card"
    :data-domain="entry.manifest.domain"
    @open="emit('open')"
  >
    <template v-if="dismissible" #corner>
      <Button
        variant="ghost"
        size="icon-sm"
        class="size-8 rounded-full bg-black/25 text-white hover:bg-black/40 hover:text-white"
        :aria-label="
          $t('settings.catalog.dont_suggest_named', {
            name: entry.manifest.name,
          })
        "
        :title="$t('settings.catalog.dont_suggest')"
        data-testid="catalog-card-dismiss"
        @click="emit('dismiss')"
      >
        <X class="size-4" aria-hidden="true" />
      </Button>
    </template>
    <template #badges>
      <Badge
        v-if="community"
        variant="community"
        data-testid="catalog-card-community"
      >
        {{ $t("settings.provider_community") }}
      </Badge>
      <ProviderStageBadge :stage="entry.manifest.stage" />
      <Badge
        v-if="isSetUp"
        variant="outline"
        class="gap-1"
        data-testid="catalog-card-added"
      >
        <Check class="size-3" aria-hidden="true" />
        {{ $t("settings.catalog.added") }}
      </Badge>
    </template>
    <p
      class="m-0 mt-0.5 text-xs text-muted-foreground"
      data-testid="catalog-card-type"
    >
      {{ typeLabel }}
    </p>
    <p
      class="m-0 mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground"
    >
      {{ entry.manifest.description }}
    </p>
    <template #footer>
      <span
        v-if="pairedWith"
        class="min-w-0 truncate text-xs text-primary"
        data-testid="catalog-card-paired"
      >
        {{ $t("settings.catalog.goes_well_with", { name: pairedWith }) }}
      </span>
      <span
        v-else
        class="min-w-0 truncate text-xs text-muted-foreground"
        data-testid="catalog-card-credit"
      >
        {{ credit }}
      </span>
      <div class="relative z-10 flex shrink-0 gap-2">
        <Button
          v-if="isSetUp"
          as-child
          variant="ghost"
          size="sm"
          :aria-label="
            $t('settings.catalog.manage_named', { name: entry.manifest.name })
          "
          data-testid="catalog-card-manage"
        >
          <RouterLink :to="manageRoute" class="no-underline">
            {{ $t("settings.catalog.manage") }}
          </RouterLink>
        </Button>
        <Button
          v-if="entry.canAdd"
          variant="outline"
          size="sm"
          :loading="installing"
          :aria-label="
            $t('settings.catalog.add_named', { name: entry.manifest.name })
          "
          data-testid="catalog-card-add"
          @click="emit('add')"
        >
          <template v-if="installing">
            {{ $t("settings.catalog.community.installing") }}
          </template>
          <template v-else>
            <Plus class="size-4" aria-hidden="true" />
            {{ $t("settings.catalog.add") }}
          </template>
        </Button>
      </div>
    </template>
  </CatalogBannerCard>
</template>

<script setup lang="ts">
import CatalogBannerCard from "@/components/settings/catalog/CatalogBannerCard.vue";
import ProviderStageBadge from "@/components/settings/providers/ProviderStageBadge.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalogEntryDetails } from "@/composables/settings/catalog/useCatalogEntryDetails";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { $t } from "@/plugins/i18n";
import { Check, Plus, X } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";

interface Props {
  entry: CatalogEntry;
  // whether it is being installed from the community catalog
  installing?: boolean;
  // the name of what it goes well with, said in place of who maintains it
  pairedWith?: string | null;
  // whether the user may ask not to have it suggested any more
  dismissible?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "open"): void;
  (e: "add"): void;
  (e: "dismiss"): void;
}>();

const { typeLabel, community, isSetUp, manageRoute, maintainers } =
  useCatalogEntryDetails(() => props.entry);

const credit = computed(() =>
  maintainers.value.length
    ? $t("settings.catalog.by_maintainers", {
        maintainers: maintainers.value.join(", "),
      })
    : $t("settings.catalog.by_team"),
);
</script>
