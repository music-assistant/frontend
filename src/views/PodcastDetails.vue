<template>
  <InfoHeader :item="itemDetails" />
  <!-- Podcast Episodes listing -->
  <div style="margin-top: 10px">
    <Toolbar :title="$t('episodes')" />
    <v-divider />
    <Container>
      <v-list>
        <ListviewItem
          v-for="episode in episodes"
          :key="episode.uri"
          :item="episode"
          :show-track-number="false"
          :show-disc-number="false"
          :show-duration="true"
          :show-favorite="false"
          :show-menu="true"
          :show-provider="false"
          :show-album="false"
          :show-checkboxes="false"
          :is-selected="false"
          @menu="onMenu"
          @click="onClick"
        />
      </v-list>
    </Container>
  </div>

  <!-- provider mapping details -->
  <ProviderDetails v-if="itemDetails" :item-details="itemDetails" />
</template>

<script setup lang="ts">
import Container from "@/components/mods/Container.vue";
import ListviewItem from "@/components/ListviewItem.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import ProviderDetails from "@/components/ProviderDetails.vue";
import Toolbar from "@/components/Toolbar.vue";
import {
  EventType,
  type Podcast,
  type EventMessage,
  type MediaItemType,
  Episode,
} from "@/plugins/api/interfaces";
import { api } from "@/plugins/api";
import { watch, ref, onMounted, onBeforeUnmount } from "vue";
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import { itemIsAvailable } from "@/plugins/api/helpers";
import { eventbus } from "@/plugins/eventbus";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const updateAvailable = ref(false);
const itemDetails = ref<Podcast>();
const episodes = ref<Episode[]>([]);

const loadItemDetails = async function () {
  itemDetails.value = await api.getPodcast(props.itemId, props.provider);
  episodes.value = await api.getPodcastEpisodes(props.itemId, props.provider);
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
      // signal user that there might be updated info available for this item
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        updateAvailable.value = true;
      }
    },
  );
  onBeforeUnmount(unsub);
});

const onMenu = function (
  item: MediaItemType | MediaItemType[],
  posX: number,
  posY: number,
) {
  const mediaItems: MediaItemType[] = Array.isArray(item) ? item : [item];
  const menuItems: ContextMenuItem[] = [];
  const episode = mediaItems[0] as Episode;
  if (episode.fully_played || episode.resume_position_ms > 0) {
    menuItems.push({
      label: "mark_unplayed",
      action: async () => {
        await api.markItemUnPlayed(
          episode.media_type,
          episode.item_id,
          episode.provider,
        );
        loadItemDetails();
      },
    });
  } else {
    menuItems.push({
      label: "mark_played",
      action: async () => {
        await api.markItemPlayed(
          episode.media_type,
          episode.item_id,
          episode.provider,
          true,
        );
        loadItemDetails();
      },
    });
  }
  // open the contextmenu by emitting the event
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: posX,
    posY: posY,
  });
};

const onClick = function (item: MediaItemType, posX: number, posY: number) {
  if (!itemDetails.value || !itemIsAvailable(item)) return;
  api.playMedia(itemDetails.value.uri, undefined, undefined, item.uri);
};
</script>
