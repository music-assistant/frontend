<template>
  <section>
    <GenreHero
      :item="itemDetails"
      :editable-rows="viewMode !== 'discovery'"
      @edit-rows="rowsEditorOpen = true"
    >
      <template #toolbar-append>
        <Button
          variant="ghost"
          size="icon-lg"
          class="mr-2 rounded-lg bg-black/35 hover:bg-black/45"
          :title="viewModeMenuLabel"
          :aria-label="viewModeMenuLabel"
          @click="openViewModeMenu"
        >
          <component :is="viewModeIcon" class="size-5" />
        </Button>
      </template>
    </GenreHero>

    <DetailTextRow
      v-if="itemDetails && itemDescription"
      :text="itemDescription"
      :dialog-title="itemDetails.name"
      markdown
    />

    <!-- Discovery view -->
    <template v-if="viewMode === 'discovery'">
      <Skeleton v-if="loadingRows" class="rows-loading h-1 w-full" />

      <div class="overview-container">
        <EditorialShelf
          v-for="row in displayRows"
          :key="row.title"
          :title="row.title"
          :tiles-per-view="tilesPerView"
          class="overview-row"
        >
          <template v-if="row.action" #title-append>
            <SquareArrowRightEnter
              :size="18"
              class="overview-row__nav"
              @click="row.action"
            />
          </template>
          <EditorialMediaCard
            v-for="item in row.items"
            :key="item.uri"
            :item="item"
            :show-provider-on-cover="true"
            :is-available="itemIsAvailable(item)"
          />
        </EditorialShelf>
      </div>
    </template>

    <!-- Traditional view -->
    <template v-else-if="itemDetails && !loading">
      <template v-for="rowId in visibleRows" :key="rowId">
        <ItemsListing
          :itemtype="rowId"
          :load-paged-data="genreListingLoaders[rowId]"
          :sort-listing="genreListingSorts[rowId]"
          :allow-collapse="true"
          :show-favorites-only-filter="true"
          :show-track-number="rowId !== 'tracks'"
          :hide-on-empty="true"
          :forced-view-mode="itemsViewMode"
          :hide-actions-by-default="wasCompact"
        >
          <template #title>
            <span>{{ $t(rowId) }}</span>
            <SquareArrowRightEnter
              :size="18"
              class="navigate-icon"
              :aria-label="$t('tooltip.view_all', { name: $t(rowId) })"
              @click.stop="navigateTo(rowId)"
            />
          </template>
        </ItemsListing>
        <br />
      </template>
    </template>

    <RowsEditor
      v-if="itemDetails && viewMode !== 'discovery'"
      v-model:open="rowsEditorOpen"
      :item="itemDetails"
      :registry="genreRows"
      :available-ids="availableRows"
      :subtitle="$t('edit_rows_subtitle_genre')"
    />

    <GenreAliasManager
      v-if="itemDetails && canManageLibrary"
      :genre="itemDetails"
      :existing-genre-names="existingGenreNames"
      @reload="loadItemDetails"
    />
  </section>
</template>

<script setup lang="ts">
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import RowsEditor from "@/components/details/RowsEditor.vue";
import GenreAliasManager from "@/components/genre/GenreAliasManager.vue";
import GenreHero from "@/components/genre/GenreHero.vue";
import {
  GENRE_ROW_IDS,
  genreRows,
  type GenreRowId,
} from "@/components/genre/genreRows";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDetailItemUpdates } from "@/composables/useDetailItemUpdates";
import type { LoadPagedDataFn } from "@/composables/useItemsListing";
import {
  updateUserPreferences,
  useUserPreferences,
} from "@/composables/userPreferences";
import { folderIdToRoute, genreMediaTypeIconMap } from "@/helpers/genre";
import { applyGenreView, GENRE_VIEW_PREFERENCE } from "@/helpers/genre_view";
import { LEGACY_COMPACT_VIEW_MODE } from "@/helpers/grid_size";
import { panelViewItemResponsive } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  Genre,
  ListingType,
  MediaItemTypeOrItemMapping,
  MediaType,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import {
  Grid2x2,
  LayoutDashboard,
  List,
  SquareArrowRightEnter,
} from "@lucide/vue";
import { computed, ref, watch, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Genre>();
const loading = ref(false);
const loadingRows = ref(false);
const rowsEditorOpen = ref(false);
const overviewRows = ref<
  Array<{
    title: string;
    items: MediaItemTypeOrItemMapping[];
    icon?: string | Component;
    action?: () => void;
  }>
>([]);
const existingGenreNames = ref<Set<string>>(new Set());

const { t } = useI18n();
const router = useRouter();

const canManageLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_MANAGE),
);
const itemDescription = computed(
  () =>
    itemDetails.value?.metadata?.description ||
    itemDetails.value?.metadata?.copyright,
);

type GenreViewMode = "discovery" | "list" | "panel";

const { getPreference } = useUserPreferences();
const savedViewMode = getPreference<GenreViewMode>(
  GENRE_VIEW_PREFERENCE,
  "discovery",
);
// the compact thumbs view became thumbs without the action buttons
const wasCompact = (savedViewMode.value as string) === LEGACY_COMPACT_VIEW_MODE;
const viewMode = ref<GenreViewMode>(wasCompact ? "panel" : savedViewMode.value);
const itemsViewMode = computed(() =>
  viewMode.value !== "discovery" ? viewMode.value : undefined,
);

const availableRows = computed(() => [...GENRE_ROW_IDS]);
const visibleRows = computed(() => {
  const { order, hidden } = genreRows.resolve(availableRows.value);
  return order.filter((rowId) => !hidden.has(rowId));
});

watch(viewMode, (newVal) => {
  void updateUserPreferences((current) => applyGenreView(current, newVal));
});

const displayRows = computed(() =>
  overviewRows.value.filter((row) => row.items?.length),
);

// Responsive tile sizing, shared curve with the rest of the app.
const tilesPerView = computed(() => panelViewItemResponsive(0) + 0.5);

const viewModeIcon = computed(() => {
  if (viewMode.value === "discovery") return LayoutDashboard;
  if (viewMode.value === "panel") return Grid2x2;
  return List;
});

const getViewModeLabel = function (mode: GenreViewMode) {
  return t(`view.${mode}`);
};

const viewModeMenuLabel = computed(() =>
  t("tooltip.view_mode_current", [getViewModeLabel(viewMode.value)]),
);

const openViewModeMenu = (e: MouseEvent) => {
  eventbus.emit("contextmenu", {
    items: [
      {
        label: "view.discovery",
        icon: LayoutDashboard,
        selected: viewMode.value === "discovery",
        action: () => {
          viewMode.value = "discovery";
        },
      },
      {
        label: "view.list",
        icon: List,
        selected: viewMode.value === "list",
        action: () => {
          viewMode.value = "list";
        },
      },
      {
        label: "view.panel",
        icon: Grid2x2,
        selected: viewMode.value === "panel",
        action: () => {
          viewMode.value = "panel";
        },
      },
    ],
    posX: e.clientX,
    posY: e.clientY,
  });
};

const navigateTo = (routeName: string) => {
  if (!itemDetails.value) return;
  router.push({
    name: routeName,
    query: { genre_ids: itemDetails.value.item_id },
  });
};

const loadItemDetails = async () => {
  loading.value = true;
  itemDetails.value = await api.getGenre(props.itemId, props.provider);
  const allGenres = await api.getLibraryGenres();
  existingGenreNames.value = new Set(
    allGenres.map((g) => g.name.toLowerCase()),
  );
  loading.value = false;
};

const loadOverviewRows = async () => {
  if (!itemDetails.value) return;
  loadingRows.value = true;

  try {
    const recommendationFolders = await api.getGenreOverviewRows(
      itemDetails.value.item_id,
      itemDetails.value.provider,
    );

    if (recommendationFolders && recommendationFolders.length > 0) {
      overviewRows.value = recommendationFolders.map((folder) => {
        return {
          title: folder.name || "",
          items: folder.items || [],
          icon: genreMediaTypeIconMap[folder.media_type],
          action: () => {
            if (!itemDetails.value) return;
            const routeName = folderIdToRoute[folder.item_id];
            if (routeName) {
              router.push({
                name: routeName,
                query: { genre_ids: itemDetails.value.item_id },
              });
            }
          },
        };
      });
    } else {
      overviewRows.value = [];
    }
  } catch (error) {
    console.error("Failed to load genre overview:", error);
    overviewRows.value = [];
  }

  // Fallback: if no overview rows returned, try loading the genre's tracks
  if (overviewRows.value.length === 0) {
    try {
      const tracks = await api.getGenreTracks(itemDetails.value.item_id);
      overviewRows.value = [
        {
          title: t("tracks"),
          items: tracks,
          icon: genreMediaTypeIconMap[MediaType.TRACK],
        },
      ];
    } catch (error) {
      console.error("Failed to load genre tracks:", error);
      overviewRows.value = [];
    }
  }

  loadingRows.value = false;
};

const genreId = () => parseInt(itemDetails.value!.item_id);

const loadGenreArtists = async (params: LoadDataParams) => {
  if (!itemDetails.value) return [];
  return await api.getLibraryArtists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
    undefined,
    params.provider?.length ? params.provider : undefined,
    genreId(),
  );
};

const loadGenreAlbums = async (params: LoadDataParams) => {
  if (!itemDetails.value) return [];
  return await api.getLibraryAlbums(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
    undefined,
    params.provider?.length ? params.provider : undefined,
    genreId(),
  );
};

const loadGenreTracks = async (params: LoadDataParams) => {
  if (!itemDetails.value) return [];
  return await api.getLibraryTracks(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
    params.provider?.length ? params.provider : undefined,
    genreId(),
  );
};

const loadGenrePlaylists = async (params: LoadDataParams) => {
  if (!itemDetails.value) return [];
  return await api.getLibraryPlaylists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
    params.provider?.length ? params.provider : undefined,
    genreId(),
  );
};

const loadGenrePodcasts = async (params: LoadDataParams) => {
  if (!itemDetails.value) return [];
  return await api.getLibraryPodcasts(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
    params.provider?.length ? params.provider : undefined,
    genreId(),
  );
};

const loadGenreAudiobooks = async (params: LoadDataParams) => {
  if (!itemDetails.value) return [];
  return await api.getLibraryAudiobooks(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortField,
    params.sortDirection,
    params.provider?.length ? params.provider : undefined,
    genreId(),
  );
};

const genreListingLoaders: Record<GenreRowId, LoadPagedDataFn> = {
  artists: loadGenreArtists,
  albums: loadGenreAlbums,
  tracks: loadGenreTracks,
  playlists: loadGenrePlaylists,
  podcasts: loadGenrePodcasts,
  audiobooks: loadGenreAudiobooks,
};

const genreListingSorts: Record<GenreRowId, ListingType> = {
  artists: ListingType.LIBRARY_ARTISTS,
  albums: ListingType.LIBRARY_ALBUMS,
  tracks: ListingType.LIBRARY_TRACKS,
  playlists: ListingType.LIBRARY_PLAYLISTS,
  podcasts: ListingType.LIBRARY_PODCASTS,
  audiobooks: ListingType.LIBRARY_AUDIOBOOKS,
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

watch(
  () => itemDetails.value?.uri,
  () => {
    loadOverviewRows();
  },
);

useDetailItemUpdates(itemDetails);
</script>

<style scoped>
.rows-loading {
  margin: 20px 0;
}

.overview-row {
  margin-top: 10px;
}

.overview-row__nav {
  align-self: center;
  cursor: pointer;
  opacity: 0.7;
}
.overview-row__nav:hover {
  opacity: 1;
}

.overview-container {
  padding: 16px 10px 16px 10px;
}

.overview-container :deep(.ed-shelf) {
  --ed-gutter: 16px;
}

.navigate-icon {
  margin-left: 6px;
  cursor: pointer;
  opacity: 0.7;
  vertical-align: middle;
}

.navigate-icon:hover {
  opacity: 1;
}
</style>
