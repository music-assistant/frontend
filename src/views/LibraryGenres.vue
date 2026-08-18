<template>
  <Toolbar
    :title="$t('genres')"
    :icon="GenreIcon"
    :menu-items="menuItems"
    :enforce-overflow-menu="true"
  />
  <ItemsListing
    v-for="section in sections"
    :key="`${section.key}-${refreshKey}`"
    itemtype="genres"
    :path="`librarygenres_${section.key}`"
    :title="$t(section.label)"
    :icon="section.icon"
    :show-provider="false"
    :show-favorites-only-filter="true"
    :show-hide-empty-filter="true"
    :show-search-button="true"
    :allow-collapse="true"
    :hide-on-empty="false"
    :sort-keys="sortKeys"
    :limit="50"
    :infinite-scroll="false"
    :load-paged-data="section.load"
  />
  <AddGenreDialog v-model="showAddGenreDialog" @success="handleGenreAdded" />
</template>

<script setup lang="ts">
import AddGenreDialog from "@/components/AddGenreDialog.vue";
import GenreIcon from "@/components/icons/GenreIcon.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import Toolbar, { type ToolBarMenuItem } from "@/components/Toolbar.vue";
import { genreContentTypeIcon } from "@/helpers/genre";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  Genre,
  MediaType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Genres",
});

const showAddGenreDialog = ref(false);
const refreshKey = ref(0);

const sortKeys = [
  "name",
  "name_desc",
  "sort_name",
  "sort_name_desc",
  "timestamp_added",
  "timestamp_added_desc",
  "play_count",
  "play_count_desc",
];

// one collapsible section per taxonomy, scoped server-side via content_type. Server-paged so
// each section's own filters (favorites / default-non-empty-all / search) re-fetch.
const loadSection = (contentType: MediaType | "music") => {
  return async (params: LoadDataParams): Promise<Genre[]> => {
    return await api.getLibraryGenres({
      content_type: contentType,
      favorite: params.favoritesOnly || undefined,
      search: params.search,
      limit: params.limit,
      offset: params.offset,
      order_by: params.sortBy,
      hide_empty: params.hideEmptyFilter,
    });
  };
};

const sections = [
  {
    key: "music",
    label: "genre_content_type.music",
    icon: genreContentTypeIcon(null),
    load: loadSection("music"),
  },
  {
    key: "podcasts",
    label: "genre_content_type.podcasts",
    icon: genreContentTypeIcon(MediaType.PODCAST),
    load: loadSection(MediaType.PODCAST),
  },
  {
    key: "audiobooks",
    label: "genre_content_type.audiobooks",
    icon: genreContentTypeIcon(MediaType.AUDIOBOOK),
    load: loadSection(MediaType.AUDIOBOOK),
  },
];

const menuItems = computed<ToolBarMenuItem[]>(() => {
  if (!authManager.isAdmin()) return [];
  return [
    {
      label: "add_genre",
      labelArgs: [],
      icon: "mdi-plus",
      action: () => {
        showAddGenreDialog.value = true;
      },
    },
  ];
});

const handleGenreAdded = () => {
  refreshKey.value++;
};

onMounted(() => {
  const unsub = api.subscribe_multi(
    [
      EventType.MEDIA_ITEM_ADDED,
      EventType.MEDIA_ITEM_UPDATED,
      EventType.MEDIA_ITEM_DELETED,
    ],
    (evt: EventMessage) => {
      if (evt.object_id?.startsWith("library://genre")) {
        refreshKey.value++;
      }
    },
  );

  onBeforeUnmount(() => {
    unsub();
  });
});
</script>
