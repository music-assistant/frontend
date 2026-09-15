<template>
  <section>
    <ItemsListing
      v-if="itemDetails && config"
      :key="config.path"
      :icon="ArrowLeft"
      :icon-action="backToArtist"
      :title="$t(config.labelKey)"
      :subtitle="subtitle"
      :itemtype="config.itemtype"
      :path="config.path"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="config.showFavoritesOnlyFilter"
      :show-provider-filter="config.showProviderFilter"
      :single-provider-filter="true"
      :provider-filter-options="config.providerFilterOptions"
      :require-provider-selection="config.requireProviderSelection"
      :library-filter-option="config.libraryFilterOption"
      :default-provider="config.defaultProvider"
      :show-album-type-filter="config.showAlbumTypeFilter"
      :show-track-number="config.showTrackNumber"
      :show-refresh-button="false"
      :sort-keys="config.sortKeys"
      :load-items="config.loadItems"
      :empty-message="config.emptyMessage"
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
import { artistRows } from "@/components/artist/artistRows";
import {
  rowSourceLabel,
  type RowSource,
} from "@/components/details/rowRegistry";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { goBack } from "@/helpers/navigation";
import { api } from "@/plugins/api";
import { type Artist, type MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
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
  providerFilterOptions: string[];
  // what the listing says when the artist has nothing to show there
  emptyMessage?: string;
  // a required single source selection: the library or one of the providers
  // the artist is mapped to
  requireProviderSelection?: boolean;
  libraryFilterOption?: boolean;
  defaultProvider?: RowSource;
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
// the source the releases were last loaded from, so the header names what is
// on screen
const activeSource = ref<RowSource>();

watch(
  () => [props.itemId, props.provider],
  async ([itemId, provider]) => {
    // the listing remounts for the new artist instead of keeping the old items
    itemDetails.value = undefined;
    activeSource.value = undefined;
    const artist = await api.getArtist(itemId, provider);
    // a slower response for a previous artist must not replace the current one
    if (itemId !== props.itemId || provider !== props.provider) return;
    itemDetails.value = artist;
  },
  { immediate: true },
);

// each shelf has its own source, so the one on screen is never another's
watch(
  () => props.listing,
  () => (activeSource.value = undefined),
);

// the listing can be filtered to the providers the artist is actually mapped to
const mappingProviderIds = computed(() => [
  ...new Set(
    (itemDetails.value?.provider_mappings || []).map(
      (mapping) => mapping.provider_instance,
    ),
  ),
]);

// the releases are shown one source at a time, so the header says which one
const subtitle = computed(() => {
  const name = itemDetails.value?.name || "";
  if (!activeSource.value) return name;
  return `${name} · ${rowSourceLabel(activeSource.value)}`;
});

const showsLibrary = computed(
  () => !activeSource.value || activeSource.value === "library",
);

const config = computed<ListingConfig | undefined>(() => {
  switch (props.listing) {
    case "albums":
      return {
        ...listingDefaults(),
        ...sourceSelection("albums"),
        labelKey: artistRows.definition("albums").labelKey,
        path: "artistalbums",
        showAlbumTypeFilter: true,
        emptyMessage: showsLibrary.value
          ? $t("artist_no_library_albums")
          : undefined,
        loadItems: async (params: LoadDataParams) =>
          (await loadReleases("albums", params)).filter(
            (album) => !isSingleOrEp(album),
          ),
      };
    case "singles":
      return {
        ...listingDefaults(),
        ...sourceSelection("singles_eps"),
        labelKey: artistRows.definition("singles_eps").labelKey,
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
        emptyMessage: $t("artist_no_library_tracks"),
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
        labelKey: artistRows.definition("appears_on").labelKey,
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
    providerFilterOptions: mappingProviderIds.value,
  };
}

/**
 * The source selector of a release listing: the same sources the row's picker
 * on the artist page offers, starting on the one feeding it there. A provider
 * artist has only its own catalog, so it gets no selector at all.
 */
function sourceSelection(rowId: "albums" | "singles_eps") {
  const artist = itemDetails.value;
  if (artist?.provider !== "library") return { showProviderFilter: false };
  return {
    requireProviderSelection: true,
    libraryFilterOption: true,
    providerFilterOptions: artistRows
      .sources(rowId, artist)
      .filter((source) => source !== "library"),
    defaultProvider: artistRows.effectiveSource(rowId, artist),
  };
}

/** The artist's releases, from the source the user picked or the row's default one. */
async function loadReleases(
  rowId: "albums" | "singles_eps",
  params: LoadDataParams,
) {
  if (!itemDetails.value) return [];
  const source =
    params.provider?.[0] ??
    artistRows.effectiveSource(rowId, itemDetails.value);
  activeSource.value = source;
  return await loadArtistReleases(itemDetails.value, source);
}

/** Albums the artist is credited on without being the album artist. */
async function loadAppearsOn(): Promise<MediaItemType[]> {
  if (!itemDetails.value) return [];
  // every album the artist's library tracks point at that is not one of their
  // own releases is an appearance
  const [tracks, releases] = await Promise.all([
    loadArtistLibraryTracks(itemDetails.value),
    loadArtistReleases(
      itemDetails.value,
      artistRows.effectiveSource("appears_on", itemDetails.value),
    ),
  ]);
  return appearsOnAlbums(
    tracks,
    itemDetails.value,
    releases,
  ) as MediaItemType[];
}
</script>
