<template>
  <div
    class="relative flex items-center gap-3 rounded-(--radius-xl) border bg-card p-3"
    data-testid="catalog-list-row"
    :data-domain="entry.manifest.domain"
  >
    <CatalogIcon
      :domain="entry.manifest.domain"
      :icon="entry.community?.icon"
      :size="40"
    />
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <h3 class="m-0 text-sm leading-snug font-semibold">
          <!-- the name stretches over the row, so the whole row opens the
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
        <Badge v-if="community" variant="community">
          {{ $t("settings.provider_community") }}
        </Badge>
      </div>
      <p class="m-0 truncate text-xs text-muted-foreground">{{ byline }}</p>
      <p class="m-0 truncate text-xs text-muted-foreground">
        {{ entry.manifest.description }}
      </p>
    </div>
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
      <Plus v-if="!installing" class="size-4" aria-hidden="true" />
      {{ $t("settings.catalog.add") }}
    </Button>
    <Badge v-else-if="isSetUp" variant="outline" class="shrink-0 gap-1">
      <Check class="size-3" aria-hidden="true" />
      {{ $t("settings.catalog.added") }}
    </Badge>
  </div>
</template>

<script setup lang="ts">
import CatalogIcon from "@/components/settings/catalog/CatalogIcon.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalogEntryDetails } from "@/composables/settings/catalog/useCatalogEntryDetails";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { $t } from "@/plugins/i18n";
import { Check, Plus } from "@lucide/vue";

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

const { community, byline, isSetUp } = useCatalogEntryDetails(
  () => props.entry,
);
</script>
