<template>
  <section
    v-if="current"
    ref="hero"
    :aria-label="$t('settings.catalog.top_pick')"
    data-testid="catalog-top-pick"
    :data-domain="current.manifest.domain"
  >
    <Card
      class="flex-col-reverse gap-0 overflow-hidden rounded-(--radius-xl) p-0 md:min-h-64 md:flex-row"
    >
      <div
        class="flex min-w-0 flex-1 flex-col items-start justify-center gap-3 p-8 max-md:p-5"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Badge class="gap-1 border-transparent bg-primary/10 text-primary">
            <Star class="fill-current" aria-hidden="true" />
            {{ $t("settings.catalog.top_pick") }}
          </Badge>
          <Badge v-if="community" variant="community">
            {{ $t("settings.provider_community") }}
          </Badge>
        </div>
        <!-- another pick replaces this text above the dots, so it is read out -->
        <div
          class="flex flex-col gap-3"
          aria-live="polite"
          aria-atomic="true"
          data-testid="catalog-top-pick-live"
        >
          <p
            v-if="reasonText"
            class="m-0 -mb-1 text-sm font-medium text-primary"
            data-testid="catalog-top-pick-reason"
          >
            {{ reasonText }}
          </p>
          <h2
            class="m-0 text-2xl leading-tight font-semibold"
            data-testid="catalog-top-pick-name"
          >
            {{ current.manifest.name }}
          </h2>
          <p
            class="m-0 line-clamp-2 max-w-prose text-sm leading-relaxed text-muted-foreground"
          >
            {{ current.manifest.description }}
          </p>
        </div>
        <div class="mt-1 flex flex-wrap gap-2">
          <Button
            :loading="installing.has(current.manifest.domain)"
            :aria-label="
              $t('settings.catalog.add_named', { name: current.manifest.name })
            "
            data-testid="catalog-top-pick-add"
            @click="emit('add', current)"
          >
            <template v-if="installing.has(current.manifest.domain)">
              {{ $t("settings.catalog.community.installing") }}
            </template>
            <template v-else>
              <Plus class="size-4" aria-hidden="true" />
              {{ $t("settings.catalog.add") }}
            </template>
          </Button>
          <Button
            variant="ghost"
            data-testid="catalog-top-pick-open"
            @click="emit('open', current)"
          >
            {{ $t("details") }}
          </Button>
          <Button
            v-if="isPersonalSuggestion(shown!)"
            variant="ghost"
            class="text-muted-foreground"
            data-testid="catalog-top-pick-dismiss"
            @click="emit('dismiss', current.manifest.domain)"
          >
            {{ $t("settings.catalog.dont_suggest") }}
          </Button>
        </div>
        <div v-if="picks.length > 1" class="-ml-1.5 flex">
          <button
            v-for="(pick, index) in picks"
            :key="pick.entry.manifest.domain"
            type="button"
            class="group flex size-6 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            :aria-label="
              $t('settings.catalog.show_pick', {
                name: pick.entry.manifest.name,
              })
            "
            :aria-current="index === shownIndex"
            data-testid="catalog-top-pick-dot"
            @click="selected = index"
          >
            <span
              class="h-1.5 rounded-full transition-all"
              :class="
                index === shownIndex
                  ? 'w-5 bg-primary'
                  : 'w-1.5 bg-muted-foreground/40 group-hover:bg-muted-foreground/70'
              "
            ></span>
          </button>
        </div>
      </div>
      <CatalogArt
        :color="color"
        class="flex h-44 shrink-0 items-center justify-center md:h-auto md:w-[45%]"
      >
        <CatalogIconTile
          :src="iconSrc"
          :size="112"
          :on-dark="onDark"
          class="relative shadow-xl max-md:size-20"
        />
      </CatalogArt>
    </Card>
  </section>
</template>

<script setup lang="ts">
import CatalogArt from "@/components/settings/catalog/CatalogArt.vue";
import CatalogIconTile from "@/components/settings/catalog/CatalogIconTile.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCatalogArt } from "@/composables/settings/catalog/useCatalogArt";
import { useCatalogEntryDetails } from "@/composables/settings/catalog/useCatalogEntryDetails";
import {
  type CatalogSuggestion,
  isPersonalSuggestion,
} from "@/helpers/catalog_recommendations";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { CatalogRecommendationReason } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Plus, Star } from "@lucide/vue";
import { useSwipe } from "@vueuse/core";
import { computed, ref, useTemplateRef } from "vue";

interface Props {
  // the pick of the day first
  picks: CatalogSuggestion[];
  // the domains being installed from the community catalog
  installing: ReadonlySet<string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "open", entry: CatalogEntry): void;
  (e: "add", entry: CatalogEntry): void;
  (e: "dismiss", domain: string): void;
}>();

const selected = ref(0);

// a pick that was just added leaves the list, so the index may point past it
const shownIndex = computed(() =>
  selected.value < props.picks.length ? selected.value : 0,
);
const shown = computed<CatalogSuggestion | undefined>(
  () => props.picks[shownIndex.value],
);
const current = computed(() => shown.value?.entry);

// why it is picked, when that is more than being popular
const reasonText = computed(() => {
  if (shown.value?.reason === CatalogRecommendationReason.DISCOVERED)
    return $t("settings.catalog.discovered_title");
  if (shown.value?.pairedWith)
    return $t("settings.catalog.goes_well_with", {
      name: shown.value.pairedWith,
    });
  return "";
});

const { community } = useCatalogEntryDetails(() => current.value!);
const { iconSrc, onDark, color } = useCatalogArt(
  () => current.value?.manifest.domain,
  () => current.value?.community?.icon,
);

// on a touch screen a swipe moves to the next or the previous pick
useSwipe(useTemplateRef<HTMLElement>("hero"), {
  onSwipeEnd: (_event, direction) => {
    const step = { left: 1, right: -1 }[direction as string];
    if (!step || props.picks.length < 2) return;
    selected.value =
      (shownIndex.value + step + props.picks.length) % props.picks.length;
  },
});
</script>
