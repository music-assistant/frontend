<template>
  <section>
    <InfoHeader :item="album" />
    <v-tabs v-model="activeTab" show-arrows grow hide-slider>
      <v-tab
        :class="activeTab == 'tracks' ? 'active-tab' : 'inactive-tab'"
        value="tracks"
      >
        {{ $t("tracks") }} ({{ albumTracks.length }})</v-tab
      >
      <v-tab
        :class="activeTab == 'versions' ? 'active-tab' : 'inactive-tab'"
        value="versions"
      >
        {{ $t("album_versions") }} ({{ albumVersions.length }})</v-tab
      >
    </v-tabs>
    <v-divider />
    <ItemsListing
      itemtype="albumtracks"
      :parent-item="album"
      :show-providers="true"
      :show-library="false"
      :load-data="loadAlbumTracks"
      :count="albumTracks.length"
      :sort-keys="['track_number', 'sort_name', 'duration']"
      v-if="activeTab == 'tracks' && albumTracks.length > 0"
    />
    <ItemsListing
      itemtype="albumversions"
      :parent-item="album"
      :show-providers="true"
      :show-library="false"
      :load-data="loadAlbumVersions"
      :count="albumVersions.length"
      :sort-keys="['sort_name', 'year']"
      v-if="activeTab == 'versions' && albumVersions.length > 0"
    />
  </section>
</template>

<script setup lang="ts">
import ItemsListing from "../components/ItemsListing.vue";
import { filteredItems } from "../components/ItemsListing.vue";
import InfoHeader from "../components/InfoHeader.vue";
import type { Album, Track } from "../plugins/api";
import { api, ProviderType } from "../plugins/api";
import { watchEffect, ref, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { store } from "../plugins/store";

export interface Props {
  item_id: string;
  provider: string;
  lazy?: boolean | string;
  refresh?: boolean | string;
}
const props = withDefaults(defineProps<Props>(), {
  lazy: true,
  refresh: false,
});
const activeTab = ref("tracks");

const album = ref<Album>();
const albumTracks = ref<Track[]>([]);
const albumVersions = ref<Album[]>([]);
const loading = ref(true);
const { t } = useI18n();

store.topBarContextMenuItems = [
  {
    title: t("refresh_item"),
    link: () => {
      albumTracks.value = [];
      albumVersions.value = [];
      loadItems(false, true);
    },
  },
];
onBeforeUnmount(() => {
  store.topBarContextMenuItems = [];
});


const loadItems = async function (lazy: boolean, refresh = false) {
  loading.value = true;
  album.value = await api.getAlbum(
    props.provider as ProviderType,
    props.item_id,
    lazy,
    refresh
  );
  // fetch additional info once main info retrieved
  albumTracks.value = await api.getAlbumTracks(
    props.provider as ProviderType,
    props.item_id
  );
  albumVersions.value = await api.getAlbumVersions(
    props.provider as ProviderType,
    props.item_id
  );
  loading.value = false;
};

watchEffect(async () => {
  await loadItems(true);
  if (album.value?.provider !== ProviderType.DATABASE) {
    await loadItems(false);
  }
  activeTab.value = "tracks";
});

const loadAlbumTracks = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true
) {
  return filteredItems(albumTracks.value, offset, limit, sort, search, inLibraryOnly);
};
const loadAlbumVersions = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true
) {
  return filteredItems(albumVersions.value, offset, limit, sort, search, inLibraryOnly);
};
</script>
