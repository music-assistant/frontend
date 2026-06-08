<template>
  <section>
    <InfoHeader :item="itemDetails" />
    <!-- albums in library (library artists only) -->
    <ItemsListing
      v-if="itemDetails && !loading && itemDetails.provider == 'library'"
      itemtype="artistalbums"
      :path="`artistalbums.${itemId}.${provider}`"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="true"
      :show-provider-filter="true"
      :single-provider-filter="true"
      :provider-filter-options="mappingProviderIds"
      :show-album-type-filter="true"
      :show-refresh-button="false"
      :load-items="loadArtistAlbums"
      :sort-keys="[
        'sort_name',
        'name',
        'year',
        'name_desc',
        'sort_name_desc',
        'year_desc',
      ]"
      :title="$t('albums')"
      :subtitle="$t('in_library')"
      :allow-collapse="true"
    />
    <!-- tracks in library (library artists only) -->
    <ItemsListing
      v-if="itemDetails && !loading && itemDetails.provider == 'library'"
      itemtype="artisttracks"
      :path="`artisttracks.${itemId}.${provider}`"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="true"
      :show-provider-filter="mappingProviderIds.length > 1"
      :single-provider-filter="true"
      :provider-filter-options="mappingProviderIds"
      :show-refresh-button="false"
      :show-track-number="false"
      :load-items="loadArtistTracks"
      :sort-keys="[
        'sort_name',
        'name',
        'album',
        'album_sort_name',
        'duration',
        'name_desc',
        'sort_name_desc',
        'duration_desc',
      ]"
      :title="$t('tracks')"
      :subtitle="$t('in_library')"
      :allow-collapse="true"
    />
    <!-- top albums -->
    <ItemsListing
      v-if="itemDetails && !loading && hasTopAlbumsProvider"
      itemtype="artistalbums"
      :path="`artisttopalbums.${itemId}.${provider}`"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-provider-filter="itemDetails.provider == 'library'"
      :single-provider-filter="true"
      :provider-filter-options="topAlbumsProviderIds"
      :show-refresh-button="false"
      :load-items="loadArtistTopAlbums"
      :sort-keys="['original', 'name', 'year', 'year_desc']"
      :title="$t('artist_topalbums')"
      :allow-collapse="true"
      :hide-on-empty="true"
    />
    <!-- top tracks -->
    <ItemsListing
      v-if="itemDetails && !loading && hasTopTracksProvider"
      itemtype="artisttracks"
      :path="`artisttoptracks.${itemId}.${provider}`"
      :parent-item="itemDetails"
      :show-provider="true"
      :show-favorites-only-filter="false"
      :show-provider-filter="itemDetails.provider == 'library'"
      :single-provider-filter="true"
      :provider-filter-options="topTracksProviderIds"
      :show-refresh-button="false"
      :show-track-number="false"
      :load-items="loadArtistTopTracks"
      :sort-keys="['original', 'name', 'duration', 'duration_desc']"
      :title="$t('artist_toptracks')"
      :allow-collapse="true"
      :hide-on-empty="true"
    />
    <!-- similar artists -->
    <ItemsListing
      v-if="itemDetails && !loading && hasSimilarArtistsProvider"
      itemtype="similarartists"
      :path="`similarartists.${itemId}.${provider}`"
      :parent-item="itemDetails"
      :show-provider="false"
      :show-favorites-only-filter="false"
      :show-library-only-filter="false"
      :show-provider-filter="itemDetails.provider == 'library'"
      :single-provider-filter="true"
      :provider-filter-options="similarArtistsProviderIds"
      :show-refresh-button="false"
      :load-items="loadSimilarArtists"
      :title="$t('similar_artists')"
      :allow-collapse="true"
      :hide-on-empty="true"
    />
    <!-- media images -->
    <MediaItemImages
      v-if="
        itemDetails?.provider == 'library' &&
        itemDetails?.metadata?.images &&
        authManager.isAdmin()
      "
      v-model="itemDetails.metadata.images"
      @update:model-value="UpdateItemInDb"
    />
    <!-- provider mapping details -->
    <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
    <br />
  </section>
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import MediaItemImages from "@/components/MediaItemImages.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import {
  EventMessage,
  EventType,
  MediaItemType,
  ProviderFeature,
  type Artist,
} from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Artist>();
const loading = ref(false);

const loadItemDetails = async function () {
  loading.value = true;
  itemDetails.value = await api.getArtist(props.itemId, props.provider);
  loading.value = false;
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
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

// instance_ids of every provider supporting a given feature (any type)
const providersWithFeature = (feature: ProviderFeature) =>
  computed(() =>
    Object.values(api.providers)
      .filter((p) => p.supported_features.includes(feature))
      .map((p) => p.instance_id),
  );

// library albums/tracks can be filtered to the providers the artist is
// actually mapped to.
const mappingProviderIds = computed(() => [
  ...new Set(
    (itemDetails.value?.provider_mappings || []).map(
      (mapping) => mapping.provider_instance,
    ),
  ),
]);

// top albums/tracks and similar artists can be filtered to any provider
// supporting the respective feature.
const topAlbumsProviderIds = providersWithFeature(
  ProviderFeature.ARTIST_TOPALBUMS,
);
const topTracksProviderIds = providersWithFeature(
  ProviderFeature.ARTIST_TOPTRACKS,
);
const similarArtistsProviderIds = providersWithFeature(
  ProviderFeature.SIMILAR_ARTISTS,
);

// a listing is shown when at least one provider can supply it
const hasTopAlbumsProvider = computed(
  () => topAlbumsProviderIds.value.length > 0,
);
const hasTopTracksProvider = computed(
  () => topTracksProviderIds.value.length > 0,
);
const hasSimilarArtistsProvider = computed(
  () => similarArtistsProviderIds.value.length > 0,
);

const loadArtistAlbums = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistAlbums(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    params.provider?.[0],
  );
};

const loadArtistTracks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistTracks(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    params.provider?.[0],
  );
};

const loadArtistTopAlbums = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistTopAlbums(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    params.provider?.[0],
  );
};

const loadArtistTopTracks = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getArtistTopTracks(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    params.provider?.[0],
  );
};

const loadSimilarArtists = async function (params: LoadDataParams) {
  if (!itemDetails.value) return [];
  return await api.getSimilarArtists(
    itemDetails.value.item_id,
    itemDetails.value.provider,
    params.provider?.[0],
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
</script>
