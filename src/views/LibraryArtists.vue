<template>
  <ItemsListing
    itemtype="artists"
    :items="items"
    :show-providers="true"
    :load-data="loadItems"
    :show-album-artists-only-filter="true"
    @toggle-album-artists-only="
      (e) => {
        albumArtistsOnly = e;
      }
    "
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import ItemsListing from "../components/ItemsListing.vue";
import api from "../plugins/api";
import { MediaType, type Artist } from "../plugins/api/interfaces";
import { store } from "../plugins/store";

const { t } = useI18n();
const items = ref<Artist[]>([]);
const albumArtistsOnly = ref(false);

const loadItems = async function (
  offset: number,
  limit: number,
  sort: string,
  search?: string,
  inLibraryOnly = true
) {
  const library = inLibraryOnly || undefined;
  if (albumArtistsOnly.value) {
    return await api.getAlbumArtists(library, search, limit, offset, sort);
  } else {
    const items = await api.getArtists(library, search, limit, offset, sort);
    console.log("items", items)
    return items
  }
};

store.topBarContextMenuItems = [
{
    label: 'sync_now',
    labelArgs: [t('artists')],
    action: () => {
      api.startSync([MediaType.ARTIST]);
    },
    icon: 'mdi-sync',
  },
];
onBeforeUnmount(() => {
  store.topBarContextMenuItems = [];
});
</script>
