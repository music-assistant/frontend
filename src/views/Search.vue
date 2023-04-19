<template>
  <div>
    <v-text-field
      id="searchInput"
      v-model="search"
      clearable
      prepend-inner-icon="mdi-magnify"
      :label="$t('type_to_search')"
      hide-details
      variant="filled"
      @focus="searchHasFocus = true"
      @blur="searchHasFocus = false"
    />

    <div>
      <v-chip-group
        v-model="viewFilter"
        column
        style="margin-top: 15px; margin-left: 10px"
      >
        <v-chip
          v-for="item in viewFilters"
          :key="item"
          filter
          outlined
        >
          {{ $t(item) }}
        </v-chip>
      </v-chip-group>

      <MediaItemContextMenu
        v-model="showContextMenu"
        :items="selectedItems"
        @clear="
          () => {
            selectedItems = [];
          }
        "
      />

      <div
        style="
          margin-left: 15px;
          margin-right: 15px;
          margin-top: 20px;
          margin-bottom: 20px;
          padding: 0;
        "
      >
        <!-- loading animation -->
        <v-progress-linear
          v-if="loading"
          indeterminate
        />

        <!-- panel view -->
        <v-row v-if="viewMode == 'panel'">
          <v-col
            v-for="item in filteredItems"
            :key="item.uri"
            :class="`col-${panelViewItemResponsive($vuetify.display.width)}`"
          >
            <PanelviewItem
              :item="item"
              :size="thumbSize"
              :is-selected="false"
              :show-checkboxes="false"
              @menu="onMenu"
              @click="onClick"
            />
          </v-col>
        </v-row>

        <!-- list view -->
        <div v-if="viewMode == 'list'">
          <RecycleScroller
            v-slot="{ item }"
            :items="filteredItems"
            :item-size="60"
            key-field="item_id"
            page-mode
          >
            <ListviewItem
              :item="item"
              :show-track-number="false"
              :show-duration="true"
              :show-library="false"
              :show-menu="true"
              :show-providers="true"
              :show-checkboxes="false"
              :is-selected="false"
              :show-details="true"
              @menu="onMenu"
              @click="onClick"
            />
          </RecycleScroller>
        </div>
      </div>
      <v-toolbar
        density="compact"
        variant="flat"
        color="transparent"
        height="45"
      >
        <span style="margin-left: 15px">{{
          $t("items_total", [filteredItems.length])
        }}</span>
        <v-spacer />

        <v-tooltip location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :icon="viewMode == 'panel' ? 'mdi-view-list' : 'mdi-grid'"
              variant="plain"
              @click="toggleViewMode()"
            />
          </template>
          <span>{{ $t("tooltip.toggle_view_mode") }}</span>
        </v-tooltip>
      </v-toolbar>
    </div>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-unused-vars,vue/no-setup-props-destructure */
import { ref, computed, onBeforeUnmount, onMounted, watch } from "vue";
import { useDisplay } from "vuetify";
import {
  MediaType,
  SearchResults,
  type MediaItemType,
} from "../plugins/api/interfaces";
import { RecycleScroller } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import { store } from "../plugins/store";
import ListviewItem from "../components/ListviewItem.vue";
import PanelviewItem from "../components/PanelviewItem.vue";
import MediaItemContextMenu from "../components/MediaItemContextMenu.vue";
import { useRouter } from "vue-router";
import { api } from "../plugins/api";
import { numberRange } from "@/utils";

export interface Props {
  initSearch?: string;
}
const compProps = defineProps<Props>();

// global refs
const router = useRouter();
const { mobile } = useDisplay();

// local refs
const viewMode = ref("list");
const viewFilter = ref(0);
const search = ref("");
const searchHasFocus = ref(false);
const searchResult = ref<SearchResults>();
const loading = ref(false);
const showContextMenu = ref(false);
const selectedItems = ref<MediaItemType[]>([]);
const throttleId = ref();

const viewFilters = ["topresult", "artists", "albums", "tracks", "playlists", "radios"];

// computed properties
const thumbSize = computed(() => {
  return mobile.value ? 140 : 150;
});

// methods

const toggleViewMode = function () {
  if (viewMode.value === "panel") viewMode.value = "list";
  else viewMode.value = "panel";
  localStorage.setItem(
    `viewMode.search.${viewFilterStr.value}`,
    viewMode.value
  );
};

const onMenu = function (item: MediaItemType) {
  selectedItems.value = [item];
  showContextMenu.value = true;
};

const onClick = function (mediaItem: MediaItemType) {
  // mediaItem in the list is clicked

  if (
    ["artist", "album", "playlist"].includes(mediaItem.media_type) ||
    !store.selectedPlayer?.available
  ) {
    router.push({
      name: mediaItem.media_type,
      params: {
        itemId: mediaItem.item_id,
        provider: mediaItem.provider,
      },
    });
  } else if (store.selectedPlayer) {
    // assume track (or radio) item
    api.playMedia(mediaItem);
  }
};

// watchers
watch(
  () => search.value,
  () => {
    clearTimeout(throttleId.value);
    throttleId.value = setTimeout(() => {
      loadSearchResults();
    }, 200);
  }
);

const panelViewItemResponsive = function (displaySize: number) {
  if (displaySize < 500) {
    return 2;
  } else if (displaySize <= 500) {
    return 3;
  } else if (displaySize <= 700) {
    return 4;
  } else if (displaySize <= 1000) {
    return 5;
  } else if (displaySize <= 1200) {
    return 6;
  } else if (displaySize <= 1500) {
    return 7;
  } else if (displaySize <= 1700) {
    return 8;
  } else if (displaySize > 1700) {
    return 9;
  } else {
    return 0;
  }
};

const loadSearchResults = async function () {
  loading.value = true;
  localStorage.setItem("globalsearch", search.value);

  if (search.value) {
    searchResult.value = await api.search(search.value);
  } else {
    searchResult.value = undefined;
  }
  loading.value = false;
};

const viewFilterStr = computed(() => {
  return viewFilters[viewFilter.value];
});

const filteredItems = computed(() => {
  if (!searchResult.value) return [];

  if (viewFilterStr.value == "artists") {
    return searchResult.value.artists;
  }
  if (viewFilterStr.value == "albums") {
    return searchResult.value.albums;
  }
  if (viewFilterStr.value == "tracks") {
    return searchResult.value.tracks;
  }
  if (viewFilterStr.value == "playlists") {
    return searchResult.value.playlists;
  }
  if (viewFilterStr.value == "radios") {
    return searchResult.value.radio;
  }
  if (viewFilterStr.value == "topresult") {
    const result: MediaItemType[] = [];

    for (const results of [
      searchResult.value.tracks,
      searchResult.value.artists,
      searchResult.value.albums,
      searchResult.value.playlists,
      searchResult.value.radio,
    ]) {
      const seenProviders: string[] = [];
      for (const item of results) {
        if (!seenProviders.includes(item.provider)) {
          result.push(item);
          seenProviders.push(item.provider);
        }
      }
    }
    return result;
  }

  return [];
});

watch(
  () => viewFilterStr.value,
  (val) => {
    if (val) {
      // get stored/default viewMode for this itemtype
      const savedViewMode = localStorage.getItem(
        `viewMode.search.${viewFilterStr.value}`
      );
      if (savedViewMode) {
        viewMode.value = savedViewMode;
      } else if (viewFilterStr.value == "artists") {
        viewMode.value = "panel";
      } else if (viewFilterStr.value == "albums") {
        viewMode.value = "panel";
      } else {
        viewMode.value = "list";
      }
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (compProps.initSearch) {
    search.value = compProps.initSearch;
  } else {
    const savedSearch = localStorage.getItem("globalsearch");
    if (savedSearch && savedSearch !== "null") {
      search.value = savedSearch;
    }
  }
});

// lifecycle hooks
const keyListener = function (e: KeyboardEvent) {
  if (showContextMenu.value) return;
  if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    selectedItems.value = filteredItems.value;
  } else if (!searchHasFocus.value && e.key == "Backspace") {
    search.value = search.value.slice(0, -1);
  } else if (!searchHasFocus.value && e.key.length == 1) {
    search.value += e.key;
  }
};

document.addEventListener("keydown", keyListener);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", keyListener);
});
</script>
