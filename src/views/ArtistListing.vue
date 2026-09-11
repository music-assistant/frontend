<template>
  <section>
    <Toolbar
      :icon="ArrowLeft"
      :icon-action="backToArtist"
      :title="config ? $t(config.labelKey) : ''"
      :subtitle="itemDetails?.name"
    />
    <ItemsListing
      v-if="itemDetails && config"
      :itemtype="config.itemtype"
      :path="config.path"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="config.showFavoritesOnlyFilter"
      :show-provider-filter="config.showProviderFilter"
      :single-provider-filter="true"
      :provider-filter-options="mappingProviderIds"
      :show-album-type-filter="config.showAlbumTypeFilter"
      :show-track-number="config.showTrackNumber"
      :show-refresh-button="false"
      :sort-keys="config.sortKeys"
      :load-items="config.loadItems"
      :restore-state="true"
    />
  </section>
</template>

<script setup lang="ts">
import {
  appearsOnAlbums,
  isSingleOrEp,
  loadArtistLibraryTracks,
  loadArtistReleases,
} from "@/components/artist/artistData";
import {
  artistRowDefinition,
  effectiveArtistRowSource,
} from "@/components/artist/artistRows";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import Toolbar from "@/components/Toolbar.vue";
import { goBack } from "@/helpers/navigation";
import { api } from "@/plugins/api";
import { type Artist, type MediaItemType } from "@/plugins/api/interfaces";
import { ArrowLeft } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
  // which of the artist page's shelves is shown in full
  listing: "albums" | "singles" | "tracks" | "appears_on";
}
const props = defineProps<Props>();

interface ListingConfig {
  labelKey: string;
  itemtype: string;
  path: string;
  sortKeys: string[];
  loadItems: (params: LoadDataParams) => Promise<MediaItemType[]>;
  showAlbumTypeFilter: boolean;
  showFavoritesOnlyFilter: boolean;
  showProviderFilter: boolean;
  showTrackNumber: boolean;
}

const ALBUM_SORT_KEYS = [
  "sort_name",
  "name",
  "year",
  "name_desc",
  "sort_name_desc",
  "year_desc",
];

const TRACK_SORT_KEYS = [
  "sort_name",
  "name",
  "album",
  "album_sort_name",
  "duration",
  "name_desc",
  "sort_name_desc",
  "duration_desc",
];

const router = useRouter();
const itemDetails = ref<Artist>();

watch(
  () => props.itemId,
  async (val) => {
    if (val) itemDetails.value = await api.getArtist(val, props.provider);
  },
  { immediate: true },
);

// the listing can be filtered to the providers the artist is actually mapped to
const mappingProviderIds = computed(() => [
  ...new Set(
    (itemDetails.value?.provider_mappings || []).map(
      (mapping) => mapping.provider_instance,
    ),
  ),
]);

const config = computed<ListingConfig | undefined>(() => {
  switch (props.listing) {
    case "albums":
      return {
        ...listingDefaults(),
        labelKey: artistRowDefinition("albums").labelKey,
        path: "artistalbums",
        showAlbumTypeFilter: true,
        loadItems: async (params: LoadDataParams) =>
          (await loadReleases("albums", params)).filter(
            (album) => !isSingleOrEp(album),
          ),
      };
    case "singles":
      return {
        ...listingDefaults(),
        labelKey: artistRowDefinition("singles_eps").labelKey,
        path: "artistsingles",
        loadItems: async (params: LoadDataParams) =>
          (await loadReleases("singles_eps", params)).filter((album) =>
            isSingleOrEp(album),
          ),
      };
    case "tracks":
      return {
        ...listingDefaults(),
        labelKey: "tracks",
        itemtype: "artisttracks",
        path: "artisttracks",
        sortKeys: TRACK_SORT_KEYS,
        showProviderFilter: mappingProviderIds.value.length > 1,
        showTrackNumber: false,
        loadItems: async (params: LoadDataParams) => {
          if (!itemDetails.value) return [];
          return await loadArtistLibraryTracks(
            itemDetails.value,
            params.provider?.[0],
          );
        },
      };
    case "appears_on":
      return {
        ...listingDefaults(),
        labelKey: artistRowDefinition("appears_on").labelKey,
        path: "artistappearson",
        showFavoritesOnlyFilter: false,
        showProviderFilter: false,
        loadItems: loadAppearsOn,
      };
    default:
      return undefined;
  }
});

const backToArtist = function () {
  goBack(router, {
    name: "artist",
    params: { provider: props.provider, itemId: props.itemId },
  });
};

/** Shared shape of the listings; every case overrides what differs. */
function listingDefaults(): Omit<
  ListingConfig,
  "labelKey" | "path" | "loadItems"
> {
  return {
    itemtype: "artistalbums",
    sortKeys: ALBUM_SORT_KEYS,
    showAlbumTypeFilter: false,
    showFavoritesOnlyFilter: true,
    showProviderFilter: true,
    showTrackNumber: true,
  };
}

/** The artist's releases, from the provider the user picked or the row's default source. */
async function loadReleases(
  rowId: "albums" | "singles_eps",
  params: LoadDataParams,
) {
  if (!itemDetails.value) return [];
  const source =
    params.provider?.[0] ??
    effectiveArtistRowSource(
      rowId,
      itemDetails.value,
      api.supportsArtistDiscography,
    );
  return await loadArtistReleases(itemDetails.value, source);
}

/** Albums the artist is credited on without being the album artist. */
async function loadAppearsOn(): Promise<MediaItemType[]> {
  if (!itemDetails.value) return [];
  // the in-library albums are the ones the artist is an album artist of, so
  // every other album their library tracks point at is an appearance
  const [tracks, albums] = await Promise.all([
    loadArtistLibraryTracks(itemDetails.value),
    loadArtistReleases(itemDetails.value, "library"),
  ]);
  return appearsOnAlbums(tracks, itemDetails.value, albums) as MediaItemType[];
}
</script>
