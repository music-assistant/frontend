<template>
  <div v-if="widgetRow.items.length" class="widget-row">
    <v-toolbar
      color="transparent"
      :style="
        widgetRow.path
          ? 'cursor: pointer; width: fit-content;'
          : 'width: fit-content;'
      "
      @click="widgetRow.path ? $router.replace(widgetRow.path) : ''"
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
        <PanelviewItem
          :item="item"
          :show-checkboxes="false"
          :show-track-number="false"
          :is-selected="false"
          @click="itemClicked"
        />
      </swiper-slide>
    </carousel>
  </div>
</template>

<script setup lang="ts">
import Carousel from '@/components/Carousel.vue';
import PanelviewItem from '@/components/PanelviewItem.vue';
import { itemIsAvailable } from '@/helpers/contextmenu';
import {
  BrowseFolder,
  MediaItemType,
  MediaType,
  PlayerQueue,
} from '@/plugins/api/interfaces';
import { eventbus } from '@/plugins/eventbus';
import router from '@/plugins/router';

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

const itemClicked = function (mediaItem: MediaItemType) {
  if (
    itemIsAvailable(mediaItem) &&
    ['artist', 'album', 'playlist'].includes(mediaItem.media_type)
  ) {
    router.push({
      name: mediaItem.media_type,
      params: {
        itemId: mediaItem.item_id,
        provider: mediaItem.provider,
      },
    });
  } else if (mediaItem.media_type === MediaType.FOLDER) {
    router.push({
      name: 'browse',
      query: { path: (mediaItem as BrowseFolder).path },
    });
  } else {
    eventbus.emit('playdialog', {
      items: [mediaItem],
      showContextMenuItems: true,
    });
  }
};
</script>

<style>
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
