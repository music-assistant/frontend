<template>
  <div v-if="widgetRow.items.length" class="widget-row">
    <v-toolbar
      class="header"
      color="transparent"
      :style="
        widgetRow.path
          ? 'cursor: pointer; width: fit-content;'
          : 'width: fit-content;'
      "
      @click="widgetRow.path ? $router.push(widgetRow.path) : ''"
    >
      <template #prepend><v-icon :icon="widgetRow.icon" /></template>

      <template #title>
        <v-badge
          v-if="widgetRow.count"
          inline
          color="grey"
          :content="widgetRow.count"
        >
          <span class="mr-3">{{ $t(widgetRow.label) }}</span>
        </v-badge>
        <template v-else>
          <span class="mr-3">{{ $t(widgetRow.label) }}</span>
        </template>
      </template>
    </v-toolbar>
    <carousel>
      <swiper-slide v-for="item in widgetRow.items" :key="item.uri">
        <PanelviewItemCompact
          :item="item"
          :permanent-overlay="
            ![MediaType.ALBUM, MediaType.TRACK, MediaType.RADIO].includes(
              item.media_type,
            )
          "
          @menu="onMenu"
          @click="onClick"
          @play="onPlayClick"
        />
      </swiper-slide>
    </carousel>
  </div>
</template>

<script setup lang="ts">
import Carousel from '@/components/Carousel.vue';
import PanelviewItemCompact from '@/components/PanelviewItemCompact.vue';
import { showContextMenuForMediaItem } from '@/layouts/default/ItemContextMenu.vue';
import api from '@/plugins/api';
import { itemIsAvailable } from '@/plugins/api/helpers';
import {
  BrowseFolder,
  MediaItemType,
  MediaType,
  PlayerQueue,
} from '@/plugins/api/interfaces';
import router from '@/plugins/router';
import { store } from '@/plugins/store';

export interface WidgetRow {
  label: string;
  icon: string;
  path?: string;
  items: MediaItemType[];
  count?: number;
  queues?: PlayerQueue[];
}

interface Props {
  widgetRow: WidgetRow;
}

const { widgetRow } = defineProps<Props>();

const onMenu = function (evt: Event, item: MediaItemType | MediaItemType[]) {
  const mediaItems: MediaItemType[] = Array.isArray(item) ? item : [item];
  showContextMenuForMediaItem(
    mediaItems,
    undefined,
    (evt as PointerEvent).clientX,
    (evt as PointerEvent).clientY,
  );
};

const onClick = function (evt: Event, item: MediaItemType) {
  // mediaItem in the list is clicked
  if (!itemIsAvailable(item)) {
    onMenu(evt, item);
    return;
  }
  if (item.media_type == MediaType.FOLDER) {
    router.push({
      name: 'browse',
      query: {
        path: (item as BrowseFolder).path,
      },
    });
  } else {
    router.push({
      name: item.media_type,
      params: {
        itemId: item.item_id,
        provider: item.provider,
      },
    });
  }
};

const onPlayClick = function (evt: Event, item: MediaItemType) {
  // play button on item is clicked
  if (!itemIsAvailable(item)) {
    onMenu(evt, item);
    return;
  }
  if (!store.activePlayerId) {
    store.showPlayersMenu = true;
    return;
  }
  api.playMedia(item.uri, undefined);
};
</script>

<style scoped>
.header.v-toolbar {
  height: 55px;
  font-family: 'JetBrains Mono Medium';
}

.home-card {
  min-width: 80px;
  text-align: center;
  padding-top: 12px;
  padding-bottom: 8px;
}

.widget-row {
  margin-bottom: 20px;
  margin-left: 0px;
  padding-left: 0px;
}

.widget-row-panel-item {
  margin-bottom: 10px;
}

.v-slide-group__prev {
  min-width: 0px !important;
}

.v-slide-group__prev.v-slide-group__prev--disabled {
  visibility: hidden;
  margin-right: -15px;
}

.v-slide-group__next {
  min-width: 15px !important;
}

.v-slide-group__next.v-slide-group__next--disabled {
  visibility: hidden;
}
</style>
