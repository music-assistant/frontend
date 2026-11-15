<template>
  <Card
    class="relative h-full gap-0 overflow-hidden rounded-(--radius-xl) card-hover p-0"
    data-testid="catalog-tile"
    :data-domain="entry.manifest.domain"
  >
    <CatalogArt :color="color" class="h-20 shrink-0" />
    <div class="flex flex-1 flex-col px-4 pb-4">
      <CatalogIconTile :src="iconSrc" :size="52" class="relative -mt-7 mb-3" />
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 class="m-0 text-base leading-snug font-semibold">
          <!-- the name stretches over the tile, so the whole tile opens the
               detail while Add stays its own control -->
          <button
            type="button"
            class="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-(--radius-xl) focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
            data-testid="catalog-card-open"
            @click="emit('open')"
          >
            {{ entry.manifest.name }}
          </button>
        </h3>
        <Badge
          v-if="community"
          variant="community"
          data-testid="catalog-card-community"
        >
          {{ $t("settings.provider_community") }}
        </Badge>
        <ProviderStageBadge :stage="entry.manifest.stage" />
      </div>
      <p
        class="m-0 mt-1 line-clamp-2 min-h-10 flex-1 text-sm leading-5 text-muted-foreground"
      >
        {{ entry.manifest.description }}
      </p>
      <div class="mt-3 flex items-center justify-between gap-3">
        <span
          class="min-w-0 truncate text-xs text-muted-foreground"
          data-testid="catalog-card-credit"
        >
          {{ byline }}
        </span>
        <Button
          v-if="entry.canAdd"
          variant="outline"
          size="sm"
          class="relative z-10 shrink-0"
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
    </div>
  </Card>
</template>

<script setup lang="ts">
import CatalogArt from "@/components/settings/catalog/CatalogArt.vue";
import CatalogIconTile from "@/components/settings/catalog/CatalogIconTile.vue";
import ProviderStageBadge from "@/components/settings/providers/ProviderStageBadge.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCatalogArt } from "@/composables/settings/catalog/useCatalogArt";
import { useCatalogEntryDetails } from "@/composables/settings/catalog/useCatalogEntryDetails";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { $t } from "@/plugins/i18n";
import { Plus } from "@lucide/vue";

interface Props {
  entry: CatalogEntry;
  // whether it is being installed from the community catalog
  installing?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "open"): void;
  (e: "add"): void;
}>();

const { community, byline } = useCatalogEntryDetails(() => props.entry);
const { iconSrc, color } = useCatalogArt(() => props.entry);
</script>
