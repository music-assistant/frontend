<template>
  <SettingsListPanel
    :title="heading"
    :count="list.filteredProviders.length"
    :view-mode="viewMode"
    :actions="actions"
    data-testid="provider-list"
    :data-list="list.type"
    @toggle-view-mode="emit('toggle-view-mode')"
  >
    <template v-if="list.showSearch || list.labels.length" #filters>
      <div class="flex flex-col gap-3">
        <ProviderFilters
          v-if="list.showSearch"
          @update:search="emit('search', $event)"
        />
        <ProviderLabelFilter
          v-if="list.labels.length"
          :model-value="list.labelFilter"
          :labels="list.labels"
          @update:model-value="emit('filter-label', $event)"
        />
      </div>
    </template>
    <div class="space-y-6">
      <section
        v-for="section in list.sections"
        :key="section.key"
        class="space-y-3"
        data-testid="provider-section"
        :data-section="section.key"
      >
        <h3
          v-if="section.label"
          class="text-muted-foreground m-0 text-sm font-medium"
        >
          {{ $t(section.label) }}
        </h3>
        <component
          :is="viewMode === 'list' ? ItemGroup : 'div'"
          :class="
            viewMode === 'list'
              ? 'gap-2'
              : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
          "
        >
          <template v-for="item in section.items" :key="item.instance_id">
            <slot name="row" :item="item"></slot>
          </template>
        </component>
      </section>
    </div>

    <Empty
      v-if="list.showMusicEmptyState"
      class="rounded-(--radius-xl) border"
      data-testid="music-sources-empty"
    >
      <EmptyMedia variant="icon">
        <Music />
      </EmptyMedia>
      <EmptyTitle>{{ $t("settings.music_sources_empty_title") }}</EmptyTitle>
      <EmptyDescription>
        {{
          $t(
            canOwnSources()
              ? "settings.music_sources_empty"
              : "settings.music_sources_shared_empty",
          )
        }}
      </EmptyDescription>
      <EmptyContent v-if="canOwnSources()">
        <Button data-testid="add-provider-empty" @click="emit('add')">
          <Plus class="size-4" />
          {{ $t("settings.add_music_provider") }}
        </Button>
      </EmptyContent>
    </Empty>

    <FilterEmptyState
      v-else-if="loaded && list.filteredProviders.length === 0"
      :icon="Puzzle"
      data-testid="providers-empty"
    />
  </SettingsListPanel>
</template>

<script setup lang="ts">
import FilterEmptyState from "@/components/FilterEmptyState.vue";
import ProviderFilters from "@/components/ProviderFilters.vue";
import ProviderLabelFilter from "@/components/settings/providers/ProviderLabelFilter.vue";
import SettingsListPanel, {
  type SettingsPanelAction,
} from "@/components/settings/SettingsListPanel.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import type { ProviderList } from "@/composables/settings/providers/useProviderSources";
import { getCatalogType } from "@/helpers/provider_catalog";
import type { ProviderLabel } from "@/helpers/provider_labels";
import { canOwnSources } from "@/helpers/provider_permissions";
import { type ProviderConfig, ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Music, Plus, Puzzle } from "@lucide/vue";
import { match } from "ts-pattern";
import { computed, markRaw } from "vue";

/**
 * A list of providers on a settings page, in a panel headed by its name, with
 * its search, its filter on what the providers offer, its add button and its
 * empty state. The page renders the row of each provider.
 */
const props = defineProps<{
  list: ProviderList;
  // whether the providers have loaded, before which no empty state shows
  loaded: boolean;
  viewMode: "list" | "card";
  // in place of the name the Marketplace gives the type of the list
  title?: string;
}>();

const emit = defineEmits<{
  (e: "search", query: string): void;
  // the list should show only the providers offering the label; null for all
  (e: "filter-label", label: ProviderLabel | null): void;
  // the Marketplace should open on the type of the list
  (e: "add"): void;
  (e: "toggle-view-mode"): void;
}>();

defineSlots<{
  row(props: { item: ProviderConfig }): unknown;
}>();

// a list is titled by the name the Marketplace gives its type, unless its page
// names it
const heading = computed(
  () =>
    props.title ??
    $t(getCatalogType(props.list.type)?.label ?? props.list.type),
);

// the empty state of the music sources carries the add button while there is
// nothing to list
const actions = computed((): SettingsPanelAction[] => {
  if (!canOwnSources() || props.list.showMusicEmptyState) return [];
  return [
    {
      key: "add-provider",
      label: addProviderLabel(props.list.type),
      shortLabel: $t("add"),
      icon: markRaw(Plus),
      onSelect: () => emit("add"),
    },
  ];
});

function addProviderLabel(type: string) {
  return match(type)
    .with(ProviderType.MUSIC, () => $t("settings.add_music_provider"))
    .with(ProviderType.PLAYER, () => $t("settings.add_player_provider"))
    .with(ProviderType.METADATA, () => $t("settings.add_metadata_provider"))
    .with(ProviderType.PLUGIN, () => $t("settings.add_plugin_provider"))
    .with(ProviderType.AUDIO_ANALYSIS, () =>
      $t("settings.add_audio_analysis_provider"),
    )
    .otherwise(() => $t("settings.add_new"));
}
</script>
