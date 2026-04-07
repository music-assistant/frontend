<template>
  <v-menu v-if="currentTrack">
    <template #activator="{ props: menuProps }">
      <Icon
        v-if="currentTrack"
        v-bind="menuProps"
        variant="button"
        icon="mdi-dots-horizontal"
        :title="$t('more_options')"
        style="padding-left: 15px; padding-right: 15px"
      />
    </template>
    <v-list>
      <v-list-item
        :prepend-icon="
          currentTrack?.favorite ? 'mdi-heart' : 'mdi-heart-outline'
        "
        :title="
          currentTrack?.favorite
            ? $t('favorites_remove')
            : $t('tooltip.favorite')
        "
        @click="onToggleFavorite"
      />
      <v-list-item
        :title="$t('add_playlist')"
        prepend-icon="mdi-plus-circle-outline"
        @click="onAddToPlaylist"
      />
      <v-list-item
        :title="$t('show_info')"
        prepend-icon="mdi-information-outline"
        @click="onShowInfo"
      />
      <v-list-item
        v-if="radioModeSupported"
        :title="$t('play_radio')"
        prepend-icon="mdi-radio-tower"
        @click="onStartRadio"
      />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon.vue";
import api from "@/plugins/api";
import {
  MediaType,
  ProviderFeature,
  QueueOption,
  type Track,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import { computed } from "vue";

const currentTrack = computed(() => {
  const item = store.curQueueItem?.media_item;
  if (item?.media_type === MediaType.TRACK) return item as Track;
  return undefined;
});

const radioModeSupported = computed(() => {
  const item = currentTrack.value;
  if (!item) return false;
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
  if (!currentTrack.value) return;
  eventbus.emit("playlistdialog", { items: [currentTrack.value] });
};

const onShowInfo = () => {
  const item = currentTrack.value;
  if (!item) return;
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
    query: { album: item.album?.uri ?? "" },
  });
};

const onToggleFavorite = () => {
  if (!currentTrack.value) return;
  api.toggleFavorite(currentTrack.value);
};

const onStartRadio = () => {
  if (!currentTrack.value) return;
  api.playMedia([currentTrack.value.uri], QueueOption.REPLACE, true);
};
</script>
