<template>
  <DropdownMenu v-if="currentItem">
    <DropdownMenuTrigger as-child>
      <Button variant="icon" :ripple="false" icon :title="$t('more_options')">
        <EllipsisIcon />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="z-[100001]">
      <DropdownMenuItem @click="onToggleFavorite">
        <Heart
          class="size-4"
          :fill="currentItem?.favorite ? 'currentColor' : 'none'"
        />
        {{
          currentItem?.favorite ? $t("favorites_remove") : $t("favorites_add")
        }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="onAddToPlaylist">
        <PlusCircle class="size-4" />
        {{ $t("add_playlist") }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="onShowInfo">
        <Info class="size-4" />
        {{ $t("show_info") }}
      </DropdownMenuItem>
      <DropdownMenuItem v-if="radioModeSupported" @click="onStartRadio">
        <RadioTower class="size-4" />
        {{ $t("play_radio") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import api from "@/plugins/api";
import { isQueueDynamicPlaylist } from "@/plugins/api/helpers";
import {
  MediaType,
  ProviderFeature,
  QueueOption,
  type Radio,
  type Track,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import {
  EllipsisIcon,
  Heart,
  Info,
  PlusCircle,
  RadioTower,
} from "lucide-vue-next";
import { computed } from "vue";

const currentTrack = computed(() => {
  const item = store.curQueueItem?.media_item;
  if (item?.media_type === MediaType.TRACK) return item as Track;
  return undefined;
});

const currentRadio = computed(() => {
  const item = store.curQueueItem?.media_item;
  if (item?.media_type === MediaType.RADIO) return item as Radio;
  return undefined;
});

const currentItem = computed(() => currentTrack.value ?? currentRadio.value);

const radioModeSupported = computed(() => {
  const item = currentTrack.value;
  if (!item) return false;
  // hide radio mode for dynamic playlists
  const queue = store.activePlayer
    ? api.queues[store.activePlayer.player_id]
    : undefined;
  if (isQueueDynamicPlaylist(queue)) return false;
  for (const provId of item.provider_mappings) {
    if (
      api.providers[provId.provider_instance]?.supported_features.includes(
        ProviderFeature.SIMILAR_TRACKS,
      )
    )
      return true;
  }
  // generic radio mode: any provider supports SIMILAR_TRACKS and track is in library
  if (item.provider === "library") {
    for (const prov of Object.values(api.providers)) {
      if (prov.supported_features.includes(ProviderFeature.SIMILAR_TRACKS))
        return true;
    }
  }
  return false;
});

const onAddToPlaylist = () => {
  if (!currentItem.value) return;
  eventbus.emit("playlistdialog", { items: [currentItem.value] });
};

const onShowInfo = () => {
  const item = currentItem.value;
  if (!item) return;
  const query = currentTrack.value?.album?.uri
    ? { album: currentTrack.value.album.uri }
    : {};
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
    query,
  });
};

const onToggleFavorite = () => {
  if (!currentItem.value) return;
  api.toggleFavorite(currentItem.value);
};

const onStartRadio = () => {
  if (!currentTrack.value) return;
  api.playMedia([currentTrack.value.uri], QueueOption.REPLACE, true);
};
</script>
