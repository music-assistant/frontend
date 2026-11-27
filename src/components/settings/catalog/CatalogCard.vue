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
        class="size-8 rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background"
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
        class="h-5 rounded-md px-1.5 text-[11px]"
        data-testid="catalog-card-community"
      >
        {{ $t("settings.provider_community") }}
      </Badge>
      <CatalogStageTag :stage="entry.manifest.stage" />
    </template>
    <template v-if="subtitle" #subtitle>{{ subtitle }}</template>
    <p
      class="m-0 mt-2.5 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground"
    >
      {{ entry.manifest.description }}
    </p>
    <template #footer>
      <!-- one status at most, the first that applies -->
      <span
        v-if="isSetUp"
        class="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400"
        data-testid="catalog-card-added"
      >
        <CircleCheck class="size-3.5 shrink-0" aria-hidden="true" />
        {{ $t("settings.catalog.added") }}
      </span>
      <span
        v-else-if="pairedWith"
        class="min-w-0 truncate text-xs text-primary"
        data-testid="catalog-card-paired"
      >
        {{ $t("settings.catalog.goes_well_with", { name: pairedWith }) }}
      </span>
      <span
        v-else-if="badge"
        class="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400"
        data-testid="catalog-card-badge"
      >
        <Sparkles class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ badge }}</span>
      </span>
      <span
        v-else-if="credit"
        class="min-w-0 truncate text-xs text-muted-foreground"
        data-testid="catalog-card-credit"
      >
        {{ credit }}
      </span>
      <div class="relative z-10 ml-auto flex shrink-0 gap-2">
        <Button
          v-if="isSetUp"
          as-child
          variant="outline"
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
        <!-- next to Manage, its icon is enough to add another one -->
        <Button
          v-if="entry.canAdd && isSetUp"
          variant="outline"
          size="icon-sm"
          :aria-label="addLabel"
          :title="$t('settings.catalog.add')"
          data-testid="catalog-card-add"
          @click="emit('add')"
        >
          <Plus class="size-4" aria-hidden="true" />
        </Button>
        <Button
          v-else-if="entry.canAdd"
          variant="outline"
          size="sm"
          :loading="installing"
          :aria-label="addLabel"
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
import CatalogStageTag from "@/components/settings/catalog/CatalogStageTag.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalogEntryDetails } from "@/composables/settings/catalog/useCatalogEntryDetails";
import { OTHER_PLUGIN_LABEL } from "@/helpers/plugin_labels";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { PROVIDER_LABEL_KEYS } from "@/helpers/provider_labels";
import { $t } from "@/plugins/i18n";
import { CircleCheck, Plus, Sparkles, X } from "@lucide/vue";
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
  // why it is suggested
  badge?: string;
  // whether to say what type it is, for a list that mixes the types
  showType?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "open"): void;
  (e: "add"): void;
  (e: "dismiss"): void;
}>();

const { typeLabel, community, labels, isSetUp, manageRoute, maintainers } =
  useCatalogEntryDetails(() => props.entry);

// what it offers, after its type in a list of every type; other only gathers
// the plugins without a label for the filter, so it tells nothing about one
const subtitle = computed(() =>
  [
    props.showType ? typeLabel.value : "",
    ...labels.value
      .filter((label) => label !== OTHER_PLUGIN_LABEL)
      .map((label) => $t(PROVIDER_LABEL_KEYS[label])),
  ]
    .filter(Boolean)
    .join(" · "),
);

// the team's own are credited in their details only
const credit = computed(() =>
  community.value && maintainers.value.length
    ? $t("settings.catalog.by_maintainers", {
        maintainers: maintainers.value.join(", "),
      })
    : "",
);

const addLabel = computed(() =>
  $t("settings.catalog.add_named", { name: props.entry.manifest.name }),
);
</script>
