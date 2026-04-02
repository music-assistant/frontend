<template>
  <ItemsListing
    itemtype="playlists"
    path="libraryplaylists"
    :show-duration="false"
    :show-provider="true"
    :show-favorites-only-filter="true"
    :load-paged-data="loadItems"
    :show-library="true"
    :sort-keys="sortKeys"
    :update-available="updateAvailable"
    :title="$t('playlists')"
    :allow-key-hooks="true"
    :show-search-button="true"
    :show-genre-filter="true"
    :extra-menu-items="extraMenuItems"
    :icon="ListMusic"
    :restore-state="true"
    :total="total"
    :show-provider-filter="true"
  />
</template>

<script setup lang="ts">
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import { ToolBarMenuItem } from "@/components/Toolbar.vue";
import api from "@/plugins/api";
import {
  EventMessage,
  EventType,
  ProviderFeature,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { toast } from "vue-sonner";
import { ListMusic } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

defineOptions({
  name: "Playlists",
});

const updateAvailable = ref(false);
const total = ref(store.libraryPlaylistsCount);
const extraMenuItems = ref<ToolBarMenuItem[]>([]);

const sortKeys = [
  "name",
  "name_desc",
  "sort_name",
  "sort_name_desc",
  "timestamp_added",
  "timestamp_added_desc",
  "timestamp_modified",
  "timestamp_modified_desc",
  "last_played",
  "last_played_desc",
  "play_count",
  "play_count_desc",
];

const loadItems = async function (params: LoadDataParams) {
  updateAvailable.value = false;
  setTotals(params);
  return await api.getLibraryPlaylists(
    params.favoritesOnly || undefined,
    params.search,
    params.limit,
    params.offset,
    params.sortBy,
    params.provider && params.provider.length > 0 ? params.provider : undefined,
    params.genreIds,
  );
};

const setTotals = async function (params: LoadDataParams) {
  if (!params.favoritesOnly && !params.provider) {
    total.value = store.libraryPlaylistsCount;
    return;
  }
  // When provider filter is active, we can't get accurate count from the count endpoint
  // The total will be determined by the actual results returned
  if (params.provider && params.provider.length > 0) {
    total.value = undefined;
    return;
  }
  total.value = await api.getLibraryPlaylistsCount(
    params.favoritesOnly || false,
  );
};

onMounted(() => {
  const playListCreateItems: ToolBarMenuItem[] = [];
  for (const prov of Object.values(api.providers).filter(
    (x) =>
      x.available &&
      (x.supported_features.includes(ProviderFeature.PLAYLIST_CREATE) ||
        x.supported_features.includes(ProviderFeature.PLAYLIST_CREATE_TRACKS) ||
        x.supported_features.includes(
          ProviderFeature.PLAYLIST_CREATE_AUDIOBOOKS,
        ) ||
        x.supported_features.includes(
          ProviderFeature.PLAYLIST_CREATE_PODCAST_EPISODES,
        ) ||
        x.supported_features.includes(ProviderFeature.PLAYLIST_CREATE_RADIOS)),
  )) {
    playListCreateItems.push({
      label: "create_playlist_on",
      labelArgs: [prov.name],
      action: () => {
        newPlaylist(prov.instance_id);
      },
      icon: "mdi-playlist-plus",
      overflowAllowed: true,
    });
  }
  if (playListCreateItems.length) {
    extraMenuItems.value.push({
      label: "create_playlist_on",
      icon: "mdi-playlist-plus",
      subItems: playListCreateItems,
      overflowAllowed: true,
    });
  }
  // import playlist from file
  extraMenuItems.value.push({
    label: "import_playlist",
    action: () => {
      triggerFileImport();
    },
    icon: "mdi-file-import",
    overflowAllowed: true,
  });
  // signal if/when items get added/updated/removed within this library
  const unsub = api.subscribe_multi(
    [
      EventType.MEDIA_ITEM_ADDED,
      EventType.MEDIA_ITEM_UPDATED,
      EventType.MEDIA_ITEM_DELETED,
    ],
    (evt: EventMessage) => {
      // signal user that there might be updated info available for this item
      if (evt.object_id?.startsWith("library://playlist")) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const newPlaylist = function (provId: string) {
  eventbus.emit("createPlaylist", { providerId: provId });
};

const triggerFileImport = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".m3u,.m3u8";
  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    if (!text.trimStart().startsWith("#EXTM3U")) {
      toast.error($t("import_playlist_invalid_file"));
      return;
    }
    // extract playlist name from #PLAYLIST: tag, fall back to filename
    const playlistMatch = text.match(/^#PLAYLIST:(.+)$/m);
    const playlistName = playlistMatch
      ? playlistMatch[1].trim()
      : file.name.replace(/\.m3u8?$/i, "");
    eventbus.emit("importPlaylistDialog", {
      m3uData: text,
      playlistName,
    });
  };
  input.click();
};
</script>
