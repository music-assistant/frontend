<template>
  <Card
    class="relative h-full gap-0 overflow-hidden rounded-(--radius-xl) card-hover p-0"
    data-testid="catalog-tile"
    :data-domain="entry.manifest.domain"
  >
    <CatalogArt :color="color" class="h-20 shrink-0" />
    <Button
      v-if="dismissible"
      variant="ghost"
      size="icon-sm"
      class="absolute top-2 right-2 z-10 size-7 rounded-full bg-black/25 text-white hover:bg-black/40 hover:text-white"
      :aria-label="
        $t('settings.catalog.dont_suggest_named', { name: entry.manifest.name })
      "
      :title="$t('settings.catalog.dont_suggest')"
      data-testid="catalog-card-dismiss"
      @click="emit('dismiss')"
    >
      <X class="size-4" aria-hidden="true" />
    </Button>
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
import { Plus, X } from "@lucide/vue";

interface Props {
  entry: CatalogEntry;
  // whether it is being installed from the community catalog
  installing?: boolean;
  // the name of what it goes well with, said in place of its type
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

const { community, byline } = useCatalogEntryDetails(() => props.entry);
const { iconSrc, color } = useCatalogArt(() => props.entry);
</script>
