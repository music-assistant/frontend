<template>
  <section class="artist-details">
    <ArtistHero :item="itemDetails" @edit-rows="rowsEditorOpen = true" />

    <template v-if="itemDetails">
      <template v-for="rowId in visibleRows" :key="rowId">
        <!-- biography -->
        <ArtistBioRow
          v-if="rowId === 'bio' && !!itemDetails.metadata?.description"
          :item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- top tracks, beside the latest release -->
        <ArtistTopTracksRow
          v-else-if="rowId === 'top_tracks' && showRow(topTracksItems)"
          :artist="itemDetails"
          :tracks="topTracksItems"
          :source-label="topTracksProvider?.name"
          :source-domain="topTracksProvider?.domain"
          :library-track-count="libraryTracks?.length"
          :latest-release="latestRelease"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- albums -->
        <ArtistReleaseShelf
          v-else-if="rowId === 'albums' && showRow(albumItems)"
          :title="$t('albums')"
          :meta="albumsMeta"
          :items="albumItems"
          :view-all-to="listingRoute('albums')"
          size="lg"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- singles & EPs -->
        <ArtistReleaseShelf
          v-else-if="rowId === 'singles_eps' && showRow(singleItems)"
          :title="$t('singles_eps')"
          :meta="singleItems?.length ? String(singleItems.length) : undefined"
          :items="singleItems"
          :view-all-to="listingRoute('singles')"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- appears on -->
        <ArtistReleaseShelf
          v-else-if="rowId === 'appears_on' && showRow(appearsOnItems)"
          :title="$t('appears_on')"
          :meta="$t('appears_on_hint')"
          :items="appearsOnItems"
          :view-all-to="listingRoute('appears_on')"
          :parent-item="itemDetails"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- similar artists -->
        <ArtistSimilarShelf
          v-else-if="rowId === 'similar_artists' && showRow(similarArtistItems)"
          :items="similarArtistItems"
          :source-label="similarArtistsProvider?.name"
          @edit-rows="rowsEditorOpen = true"
        />

        <!-- audiobooks in library (library authors/narrators only) -->
        <ItemsListing
          v-else-if="
            rowId === 'audiobooks' &&
            !loading &&
            itemDetails.provider == 'library'
          "
          itemtype="artistaudiobooks"
          path="artistaudiobooks"
          :parent-item="itemDetails"
          :show-provider="true"
          :show-favorites-only-filter="true"
          :show-provider-filter="true"
          :single-provider-filter="true"
          :provider-filter-options="mappingProviderIds"
          :show-album-type-filter="false"
          :show-refresh-button="false"
          :load-items="loadArtistAudiobooks"
          :sort-keys="[
            'sort_name',
            'name',
            'year',
            'name_desc',
            'sort_name_desc',
            'year_desc',
          ]"
          :title="$t('audiobooks')"
          :subtitle="$t('in_library')"
          :empty-message="$t('artist_no_library_audiobooks')"
          :allow-collapse="true"
          :show-collapse-collections="true"
        />

        <!-- all audiobooks (full per-provider listing) -->
        <ItemsListing
          v-else-if="
            rowId === 'audiobooks_all' &&
            !loading &&
            audiobookSourceProviderIds.length > 0
          "
          itemtype="artistaudiobooks"
          path="artistallaudiobooks"
          :parent-item="itemDetails"
          :show-provider="false"
          :show-favorites-only-filter="false"
          :require-provider-selection="true"
          :provider-filter-options="audiobookSourceProviderIds"
          :show-refresh-button="false"
          :load-items="loadAllAudiobooks"
          :sort-keys="[
            'original',
            'name',
            'sort_name',
            'year',
            'name_desc',
            'sort_name_desc',
            'year_desc',
          ]"
          :title="$t('artist_all_audiobooks')"
          :subtitle="$t('on_provider', [activeAudiobookProvider])"
          :allow-collapse="true"
        />

        <!-- provider mapping details -->
        <div v-else-if="rowId === 'provider_mappings'" class="artist-admin">
          <ProviderDetails :item-details="itemDetails" />
        </div>

        <!-- media images -->
        <div
          v-else-if="
            rowId === 'artwork' &&
            itemDetails.provider == 'library' &&
            itemDetails.metadata?.images
          "
          class="artist-admin"
        >
          <MediaItemImages
            v-model="itemDetails.metadata.images"
            @update:model-value="UpdateItemInDb"
          />
        </div>
      </template>
    </template>
    <ArtistRowsEditor
      v-if="itemDetails"
      v-model:open="rowsEditorOpen"
      :artist="itemDetails"
      :available-ids="availableRows"
      :row-meta="rowMeta"
    />
    <br />
  </section>
</template>

<script setup lang="ts">
import ArtistBioRow from "@/components/artist/ArtistBioRow.vue";
import ArtistHero from "@/components/artist/ArtistHero.vue";
import ArtistReleaseShelf from "@/components/artist/ArtistReleaseShelf.vue";
import ArtistRowsEditor from "@/components/artist/ArtistRowsEditor.vue";
import {
  availableArtistRowIds,
  resolveArtistRows,
  type ArtistRowId,
} from "@/components/artist/artistRows";
import ArtistSimilarShelf from "@/components/artist/ArtistSimilarShelf.vue";
import ArtistTopTracksRow from "@/components/artist/ArtistTopTracksRow.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import MediaItemImages from "@/components/MediaItemImages.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { useArtistRowData } from "@/composables/useArtistRowData";
import { api } from "@/plugins/api";
import {
  ArtistType,
  EventMessage,
  EventType,
  MediaItemType,
  ProviderFeature,
  Scope,
  type Artist,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();

const itemDetails = ref<Artist>();
const loading = ref(false);
const rowsEditorOpen = ref(false);

const isAudiobookArtist = computed(() => {
  const artistType = itemDetails.value?.artist_type;
  return artistType === ArtistType.AUTHOR || artistType === ArtistType.NARRATOR;
});

// the rows the page can render for this artist; the editor lists the same set
const availableRows = computed(() =>
  availableArtistRowIds(
    isAudiobookArtist.value,
    authManager.hasScope(Scope.LIBRARY_MANAGE),
  ).filter(rowApplies),
);

// reads the user's preferences from the store, so the page follows the editor
const visibleRows = computed(() => {
  const { order, hidden } = resolveArtistRows(availableRows.value);
  return order.filter((rowId) => !hidden.has(rowId));
});

const {
  libraryTracks,
  topTracksItems,
  albumItems,
  singleItems,
  appearsOnItems,
  similarArtistItems,
  latestRelease,
  albumsMeta,
  topTracksProvider,
  similarArtistsProvider,
} = useArtistRowData(itemDetails, visibleRows);

// how much each row currently holds, for the editor's per-row meta line (it
// adds the source itself)
const rowMeta = computed<Partial<Record<ArtistRowId, string>>>(() => ({
  top_tracks: libraryTracks.value?.length
    ? $t("all_n_tracks", libraryTracks.value.length, {
        named: { count: libraryTracks.value.length },
      })
    : undefined,
  albums: albumsMeta.value,
  singles_eps: singleItems.value?.length
    ? String(singleItems.value.length)
    : undefined,
  appears_on: $t("appears_on_hint"),
}));

// library audiobooks can be filtered to the providers the artist is mapped to
const mappingProviderIds = computed(() => [
  ...new Set(
    (itemDetails.value?.provider_mappings || []).map(
      (mapping) => mapping.provider_instance,
    ),
  ),
]);

// unique providers the artist is mapped to that can supply the full
// per-provider audiobook listing. each entry keeps the artist's id on that
// provider so the backend can be queried directly for its complete catalog.
const audiobookSourceMappings = computed(() => {
  const feature =
    itemDetails.value?.artist_type === ArtistType.AUTHOR
      ? ProviderFeature.AUTHOR_AUDIOBOOKS
      : ProviderFeature.NARRATOR_AUDIOBOOKS;
  const seen = new Set<string>();
  const mappings: { provider_instance: string; item_id: string }[] = [];
  for (const mapping of itemDetails.value?.provider_mappings || []) {
    if (seen.has(mapping.provider_instance)) continue;
    const provider = api.providers[mapping.provider_instance];
    if (!provider?.supported_features.includes(feature)) continue;
    seen.add(mapping.provider_instance);
    mappings.push({
      provider_instance: mapping.provider_instance,
      item_id: mapping.item_id,
    });
  }
  // first entry is the default source: sort by provider name to match the
  // (alphabetically sorted) order shown in the provider selector.
  return mappings.sort((a, b) =>
    (api.providers[a.provider_instance]?.name || "").localeCompare(
      api.providers[b.provider_instance]?.name || "",
    ),
  );
});

const audiobookSourceProviderIds = computed(() =>
  audiobookSourceMappings.value.map((mapping) => mapping.provider_instance),
);

const activeAudiobookProvider = computed(
  () => api.providers[audiobookSourceProviderIds.value[0]]?.name || "",
);

const loadItemDetails = async function () {
  const { itemId, provider } = props;
  // the previous artist must not stay actionable under the new route
  itemDetails.value = undefined;
  loading.value = true;
  const artist = await api.getArtist(itemId, provider);
  // a slower response for a previous artist must not replace the current one
  if (itemId !== props.itemId || provider !== props.provider) return;
  itemDetails.value = artist;
  loading.value = false;
};

watch(
  () => [props.itemId, props.provider],
  ([itemId]) => {
    if (itemId) loadItemDetails();
  },
  { immediate: true },
);

// a new artist starts at the top of the page; anything else (a favorite
// toggle, a metadata update) leaves the page where the user left it
watch(
  () => itemDetails.value?.uri,
  () => {
    document.querySelector(".content-section")?.scrollTo({ top: 0 });
  },
);

onMounted(() => {
  //signal if/when item updates
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      // check if the updated item is the current item
      if (itemDetails.value?.uri == updatedItem.uri) {
        // update UI with the updated item
        loading.value = true;
        itemDetails.value = updatedItem as Artist;
        loading.value = false;
      } else if ("provider_mappings" in updatedItem) {
        for (const provMap of updatedItem.provider_mappings) {
          if (
            provMap.item_id == props.itemId &&
            [provMap.provider_instance, provMap.provider_domain].includes(
              props.provider,
            )
          ) {
            loading.value = true;
            itemDetails.value = updatedItem as Artist;
            loading.value = false;
            break;
          }
        }
      }
    },
  );
  onBeforeUnmount(unsub);
});

const loadArtistAudiobooks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistAudiobooks(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    itemDetails.value.artist_type,
    undefined,
    params.collapseCollections,
  );
};

const loadAllAudiobooks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  const mappings = audiobookSourceMappings.value;
  const providerId = params.provider?.[0] ?? mappings[0]?.provider_instance;
  const source = mappings.find((m) => m.provider_instance === providerId);
  if (!source) return [];
  return await api.getArtistAudiobooks(
    source.item_id,
    source.provider_instance,
    itemDetails.value.artist_type,
  );
};

const UpdateItemInDb = async function () {
  if (!itemDetails.value) return;
  itemDetails.value = await api.sendCommand("music/artists/update", {
    item_id: itemDetails.value.item_id,
    update: itemDetails.value,
    overwrite: true,
  });
};

/** Whether the artist can have the row at all: some rows are library-only. */
function rowApplies(rowId: ArtistRowId): boolean {
  const isLibraryItem = itemDetails.value?.provider === "library";
  switch (rowId) {
    case "appears_on":
    case "audiobooks":
      return isLibraryItem;
    case "audiobooks_all":
      return audiobookSourceProviderIds.value.length > 0;
    case "artwork":
      return isLibraryItem && !!itemDetails.value?.metadata?.images;
    default:
      return true;
  }
}

/** A row is rendered while it loads and once it has something to show. */
function showRow(items?: unknown[]): boolean {
  return items === undefined || items.length > 0;
}

/** The "View all" target of a shelf. */
function listingRoute(listing: string): RouteLocationRaw | undefined {
  if (!itemDetails.value) return undefined;
  return {
    name: "artistlisting",
    params: {
      provider: itemDetails.value.provider,
      itemId: itemDetails.value.item_id,
      listing,
    },
  };
}
</script>

<style scoped>
/* the shared admin sections keep their own toolbar and content, but take the
   page's row title and gutter and sit in a card each; their inline bottom margin
   is the only spacing they set themselves, hence the override */
.artist-admin :deep(section) {
  margin: 16px 28px 0 !important;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  overflow: hidden;
}
.artist-admin :deep(.v-toolbar-title) {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
}
.artist-admin :deep(.v-divider) {
  display: none;
}
/* the lists and image tiles inside sit on the card instead of painting their own surface */
.artist-admin :deep(.v-container) {
  padding: 0 12px 12px;
}
.artist-admin :deep(.v-list),
.artist-admin :deep(.panel-item) {
  background: transparent;
  box-shadow: none;
}
.artist-admin :deep(.v-list) {
  padding: 0;
}
/* uniform square image tiles instead of percentage columns, one row per image type */
.artist-admin :deep(.v-row) {
  margin: 0 0 12px;
  gap: 12px;
}
.artist-admin :deep(.v-row:empty) {
  display: none;
}
.artist-admin :deep(.v-col) {
  flex: 0 0 auto;
  width: 176px;
  max-width: 176px;
  padding: 0;
}
.artist-admin :deep(.panel-item) {
  padding: 8px;
  /* outweighs the equally-!important radius the card's tile utility carries */
  border-radius: 12px !important;
}
.artist-admin :deep(.panel-item:hover) {
  background: rgba(var(--v-theme-on-surface), 0.08);
  box-shadow: none;
}
.artist-admin :deep(.panel-item .v-img) {
  aspect-ratio: 1 / 1;
  border-radius: 8px;
}
.artist-admin :deep(.panel-item .v-img__img) {
  object-fit: cover;
}

@media (max-width: 768px) {
  .artist-admin :deep(section) {
    margin: 12px 16px 0 !important;
  }
  .artist-admin :deep(.v-toolbar-title) {
    font-size: 19px;
  }
}
</style>
