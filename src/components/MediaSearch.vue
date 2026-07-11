<template>
  <div class="media-search">
    <SearchInput
      :id="inputId"
      v-model="query"
      clearable
      :placeholder="placeholder || $t('type_to_search')"
      :aria-label="$t('search')"
    >
      <!-- media type filter inlined in the search box -->
      <template v-if="showMediaTypeFilter" #append>
        <FacetedFilter
          v-model="selectedMediaTypes"
          :title="$t('media_type')"
          :options="mediaTypeOptions"
        >
          <template #trigger>
            <InputGroupButton
              type="button"
              class="media-search-type-trigger"
              :title="$t('media_type')"
              :aria-label="$t('media_type')"
            >
              <ListFilter class="size-4" />
              <span
                v-if="selectedMediaTypes.length"
                class="media-search-type-count"
              >
                {{ selectedMediaTypes.length }}
              </span>
            </InputGroupButton>
          </template>
        </FacetedFilter>
      </template>
    </SearchInput>

    <div
      v-if="showProviderFilter && providerTargets.length"
      class="media-search-filters"
    >
      <FacetedFilter
        v-model="selectedProviders"
        :title="$t('settings.providers')"
        :options="providerOptions"
      />
    </div>

    <!-- results panel: filled progressively while targets respond -->
    <div v-if="panelVisible" class="media-search-results">
      <button
        v-for="item in flatResults"
        :key="item.uri"
        type="button"
        class="media-search-result"
        @click="onResultClick(item)"
      >
        <MediaItemThumb :item="item" :size="44" />
        <span class="media-search-result-text">
          <strong class="truncate">{{ item.name }}</strong>
          <small class="truncate">{{ itemSubtitle(item) }}</small>
        </span>
      </button>
      <p v-if="loading" class="media-search-note">
        {{ $t("searching") }}
      </p>
      <p v-else-if="flatResults.length === 0" class="media-search-note">
        {{ $t("no_content") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import FacetedFilter from "@/components/FacetedFilter.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { InputGroupButton } from "@/components/ui/input-group";
import { SearchInput } from "@/components/ui/search-input";
import {
  LIBRARY_SEARCH_TARGET,
  SEARCHABLE_MEDIA_TYPES,
  useProgressiveSearch,
} from "@/composables/useProgressiveSearch";
import { getArtistsString } from "@/helpers/utils";
import {
  MediaType,
  type MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ListFilter } from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";

export interface Props {
  // media types this search can return (also the media type filter options)
  allowedMediaTypes?: MediaType[];
  // media types selected when the component mounts
  defaultSelectedMediaTypes?: MediaType[];
  // show the media type filter (default: when more than one type is allowed)
  showMediaTypeFilter?: boolean;
  // show the provider filter (library + available providers)
  showProviderFilter?: boolean;
  // per-target result limit per media type
  limit?: number;
  // hide these items from the results (e.g. items already selected)
  excludeUris?: string[];
  placeholder?: string;
  minLength?: number;
  debounceMs?: number;
  inputId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  allowedMediaTypes: () => SEARCHABLE_MEDIA_TYPES,
  defaultSelectedMediaTypes: () => [],
  showMediaTypeFilter: undefined,
  showProviderFilter: false,
  limit: 8,
  excludeUris: () => [],
  placeholder: undefined,
  minLength: 2,
  debounceMs: 300,
  inputId: undefined,
});

const emit = defineEmits<{
  (e: "select", item: MediaItemTypeOrItemMapping): void;
}>();

const query = ref("");
const selectedMediaTypes = ref<MediaType[]>(
  props.defaultSelectedMediaTypes.filter((mediaType) =>
    props.allowedMediaTypes.includes(mediaType),
  ),
);
const selectedProviders = ref<string[]>([]);
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const { loading, providerTargets, search, filteredItems } =
  useProgressiveSearch({
    mediaTypes: selectedMediaTypes,
    providers: selectedProviders,
    allowedMediaTypes: props.allowedMediaTypes,
    limits: { single: props.limit, multi: props.limit },
  });

const showMediaTypeFilter = computed(
  () => props.showMediaTypeFilter ?? props.allowedMediaTypes.length > 1,
);

const mediaTypeOptions = computed(() =>
  props.allowedMediaTypes.map((mediaType) => ({
    label: $t(mediaType + "s"),
    value: mediaType,
  })),
);

const providerOptions = computed(() => [
  { label: $t("library"), value: LIBRARY_SEARCH_TARGET },
  ...providerTargets.value.map((target) => ({
    label: target.name,
    value: target.id,
  })),
]);

const panelVisible = computed(
  () => query.value.trim().length >= props.minLength,
);

// merged results as one flat list: the selected (or allowed) media types in
// their fixed order, minus the excluded items
const flatResults = computed<MediaItemTypeOrItemMapping[]>(() => {
  const mediaTypes = selectedMediaTypes.value.length
    ? selectedMediaTypes.value
    : props.allowedMediaTypes;
  const excluded = new Set(props.excludeUris);
  const items: MediaItemTypeOrItemMapping[] = [];
  for (const mediaType of SEARCHABLE_MEDIA_TYPES) {
    if (!mediaTypes.includes(mediaType)) continue;
    items.push(...filteredItems(mediaType));
  }
  return items.filter((item) => !excluded.has(item.uri));
});

const itemSubtitle = function (item: MediaItemTypeOrItemMapping) {
  const label = $t(item.media_type);
  const artists =
    "artists" in item && item.artists?.length
      ? getArtistsString(item.artists)
      : "";
  return artists ? `${label} • ${artists}` : label;
};

const onResultClick = function (item: MediaItemTypeOrItemMapping) {
  emit("select", item);
  // picking a result completes the search: clear the query, which also
  // closes the results panel (ready for the next search)
  query.value = "";
};

watch(query, () => {
  clearTimeout(debounceTimer);
  const trimmed = query.value.trim();
  if (trimmed.length < props.minLength) {
    search("");
    return;
  }
  debounceTimer = setTimeout(() => search(trimmed), props.debounceMs);
});

onBeforeUnmount(() => {
  clearTimeout(debounceTimer);
});
</script>

<style scoped>
.media-search {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-search-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.media-search-type-trigger {
  gap: 4px;
}

.media-search-type-count {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: 0.7rem;
  line-height: 16px;
  text-align: center;
  background: rgba(var(--v-theme-on-surface), 0.12);
}

.media-search-results {
  max-height: 288px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  padding: 4px;
  background: rgb(var(--v-theme-background));
}

.media-search-result {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
}

.media-search-result:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
}

.media-search-result-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.media-search-result-text small {
  opacity: 0.7;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-search-note {
  padding: 12px 8px;
  font-size: 0.875rem;
  opacity: 0.7;
}
</style>
