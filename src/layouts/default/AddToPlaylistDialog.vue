<!--
  Global dialog to add item(s) to a playlist.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <Sheet v-model:open="show">
    <SheetContent side="bottom" class="h-[55vh] flex flex-col p-0">
      <SheetHeader class="flex-row items-center gap-3 border-b px-4 py-3">
        <ListPlus class="size-5 shrink-0 opacity-80" />
        <SheetTitle>{{ $t("add_playlist") }}</SheetTitle>
      </SheetHeader>
      <SheetDescription class="sr-only">
        {{ $t("add_playlist") }}
      </SheetDescription>

      <ScrollArea class="h-full max-h-full overflow-hidden flex-1">
        <div class="pt-2 pb-8">
          <button
            v-for="playlist of playlists"
            :key="playlist.item_id"
            type="button"
            class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
            @click="addToPlaylist(playlist)"
          >
            <div class="shrink-0">
              <MediaItemThumb :item="playlist" :size="50" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">
                {{ playlist.name }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ playlist.owner }}
              </div>
            </div>
            <provider-icon
              v-if="playlist.provider_mappings"
              :domain="playlist.provider_mappings[0].provider_domain"
              :size="20"
              class="shrink-0"
            />
          </button>

          <div class="py-4">
            <Separator />
          </div>

          <button
            v-for="providerId of createPlaylistProviders"
            :key="providerId"
            class="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
            @click="newPlaylist(providerId)"
          >
            <div class="shrink-0">
              <provider-icon
                :domain="api.providers[providerId].domain"
                :size="50"
              />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">
                {{ $t("new_playlist") }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ $t("create_playlist_on", [api.providers[providerId].name]) }}
              </div>
            </div>
            <provider-icon
              :domain="api.providers[providerId].domain"
              :size="20"
              class="shrink-0"
            />
          </button>
        </div>
      </ScrollArea>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import api from "@/plugins/api";
import type {
  MediaItemType,
  MediaItemTypeOrItemMapping,
  Playlist,
} from "@/plugins/api/interfaces";
import { MediaType, ProviderFeature } from "@/plugins/api/interfaces";
import { eventbus, PlaylistDialogEvent } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ListPlus } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

const show = ref<boolean>(false);
const playlists = ref<Playlist[]>([]);
const createPlaylistProviders = ref<string[]>([]);
const parentItem = ref<MediaItemType>();
const selectedItems = ref<MediaItemTypeOrItemMapping[]>([]);

watch(show, (open) => {
  store.dialogActive = open;
});

onMounted(() => {
  eventbus.on("playlistdialog", async (evt: PlaylistDialogEvent) => {
    show.value = true;
    selectedItems.value = evt.items;
    parentItem.value = evt.parentItem;
    await fetchPlaylists();
  });
  onBeforeUnmount(() => {
    eventbus.off("playlistdialog");
  });
});

const fetchPlaylists = async function () {
  // get all (editable) playlists that are suitable as target
  playlists.value = [];
  createPlaylistProviders.value = [];
  const playlistResults = await api.getLibraryPlaylists(
    undefined,
    undefined,
    undefined,
  );
  let refItem = selectedItems.value.length ? selectedItems.value[0] : undefined;

  if (!refItem) return;
  if (!("provider_mappings" in refItem)) {
    // resolve itemmapping
    refItem = await api.getItem(
      refItem.media_type,
      refItem.item_id,
      refItem.provider,
    );
  }

  for (const playlist of playlistResults) {
    // skip unavailable playlists
    if (!playlist.provider_mappings.filter((x) => x.available).length) continue;
    // skip non-editable playlists
    if (!playlist.is_editable) continue;
    // skip playlist that is currently opened (=parentItem)
    if (
      parentItem.value &&
      parentItem.value.media_type === MediaType.PLAYLIST &&
      playlist.item_id === parentItem.value.item_id
    )
      continue;
    let _supported_mediatypes = playlist.supported_mediatypes;
    if (_supported_mediatypes.includes(MediaType.TRACK))
      // backend unwraps albums to individual tracks
      _supported_mediatypes.push(MediaType.ALBUM);
    if (!_supported_mediatypes.includes(refItem.media_type)) {
      // target playlist doesn't support media type
      continue;
    }

    const playListProvider =
      api.providers[playlist.provider_mappings[0].provider_instance];

    // either the refItem has a provider match or builtin provider or streaming provider
    if (
      playListProvider &&
      (playListProvider.domain == "builtin" ||
        playListProvider.is_streaming_provider ||
        refItem?.provider_mappings.filter(
          (x) => x.provider_instance == playListProvider.instance_id,
        ).length)
    ) {
      playlists.value.push(playlist);
    }
  }
  // determine which providers may be used to create a new playlist
  for (const provider of Object.values(api.providers)) {
    // filter suitable create provider base on media_type
    if (
      // album is unwrapped to individual tracks by backend
      (refItem.media_type == MediaType.TRACK ||
        refItem.media_type == MediaType.ALBUM) &&
      !provider.supported_features.includes(ProviderFeature.PLAYLIST_CREATE) &&
      !provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_TRACKS,
      )
    )
      continue;
    if (
      refItem.media_type == MediaType.AUDIOBOOK &&
      !provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_AUDIOBOOKS,
      )
    )
      continue;
    if (
      refItem.media_type == MediaType.PODCAST_EPISODE &&
      !provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_PODCAST_EPISODES,
      )
    )
      continue;
    if (
      refItem.media_type == MediaType.RADIO &&
      !provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_RADIOS,
      )
    )
      continue;
    if (
      !provider.supported_features.includes(
        ProviderFeature.PLAYLIST_TRACKS_EDIT,
      )
    )
      continue;
    // either the refItem has a provider match or builtin provider
    if (
      provider.domain == "builtin" ||
      provider.is_streaming_provider ||
      refItem?.provider_mappings.filter(
        (x) => x.provider_instance == provider.instance_id,
      ).length
    ) {
      createPlaylistProviders.value.push(provider.instance_id);
    }
  }
};
const addToPlaylist = async function (value: MediaItemType) {
  // add item(s) to playlist
  api.addPlaylistTracks(
    value.item_id,
    selectedItems.value.map((x) => x.uri),
  );
  close();
  toast.info($t("background_task_added"));
};
const newPlaylist = async function (provId: string) {
  let refItem = selectedItems.value.length ? selectedItems.value[0] : undefined;
  if (!refItem) return;
  let provider = api.getProvider(provId);
  if (!provider) return;
  const name = prompt($t("new_playlist_name"));
  if (!name) return;

  let supportedMediaTypes: MediaType[] = [];
  if (
    provider.supported_features.includes(ProviderFeature.PLAYLIST_CREATE_MIXED)
  ) {
    // if the provider supports mixed playlists, we always create a playlist for all
    // supported media types
    if (
      provider.supported_features.includes(ProviderFeature.PLAYLIST_CREATE) ||
      provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_TRACKS,
      )
    )
      supportedMediaTypes.push(MediaType.TRACK);
    if (
      provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_AUDIOBOOKS,
      )
    )
      supportedMediaTypes.push(MediaType.AUDIOBOOK);
    if (
      provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_PODCAST_EPISODES,
      )
    )
      supportedMediaTypes.push(MediaType.PODCAST_EPISODE);
    if (
      provider.supported_features.includes(
        ProviderFeature.PLAYLIST_CREATE_RADIOS,
      )
    )
      supportedMediaTypes.push(MediaType.RADIO);
  } else {
    // otherwise the playlist must support the mediatype of the selected item
    supportedMediaTypes = [refItem.media_type];
  }
  const newPlaylist = await api.createPlaylist(
    name,
    provId,
    supportedMediaTypes,
  );
  addToPlaylist(newPlaylist);
};

const close = function () {
  show.value = false;
};
</script>
