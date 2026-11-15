<template>
  <Card
    class="relative h-full gap-4 rounded-(--radius-xl) card-hover p-5 max-md:p-4"
    data-testid="catalog-card"
    :data-domain="entry.manifest.domain"
  >
    <div class="flex items-start gap-4">
      <CatalogIcon
        :domain="entry.manifest.domain"
        :icon="entry.community?.icon"
        :size="48"
      />
      <div class="min-w-0 flex-1">
        <h3 class="m-0 text-base leading-snug font-semibold">
          <!-- the name stretches over the card, so the whole card opens the
               detail while the actions below stay their own controls -->
          <button
            type="button"
            class="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-(--radius-xl) focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
            data-testid="catalog-card-open"
            @click="emit('open')"
          >
            {{ entry.manifest.name }}
          </button>
        </h3>
        <p class="m-0 mt-0.5 text-xs text-muted-foreground">
          {{ typeLabel }}
        </p>
      </div>
    </div>

    <p
      class="m-0 line-clamp-2 flex-1 text-sm leading-normal text-muted-foreground"
    >
      {{ entry.manifest.description }}
    </p>

    <div class="flex flex-wrap items-center gap-1.5">
      <Badge
        v-if="community"
        variant="secondary"
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
    </div>

    <div class="flex items-center justify-between gap-3">
      <span
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
    </div>
  </Card>
</template>

<script setup lang="ts">
import CatalogIcon from "@/components/settings/catalog/CatalogIcon.vue";
import ProviderStageBadge from "@/components/settings/providers/ProviderStageBadge.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCatalogEntryDetails } from "@/composables/settings/catalog/useCatalogEntryDetails";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { $t } from "@/plugins/i18n";
import { Check, Plus } from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";

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
