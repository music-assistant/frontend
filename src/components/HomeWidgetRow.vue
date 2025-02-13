<template>
  <div class="widget-row">
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
    <v-alert v-if="widgetRow.items.length == 0">
      {{ $t("no_content") }}
    </v-alert>
    <carousel v-else>
      <swiper-slide v-for="item in widgetRow.items" :key="item.uri">
        <PanelviewItemCompact
          :item="item"
          :permanent-overlay="
            ![MediaType.ALBUM, MediaType.TRACK, MediaType.RADIO].includes(
              item.media_type,
            )
          "
          :is-available="itemIsAvailable(item)"
        />
      </swiper-slide>
    </carousel>
  </div>
</template>

<script setup lang="ts">
import Carousel from "@/components/Carousel.vue";
import PanelviewItemCompact from "@/components/PanelviewItemCompact.vue";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaItemTypeOrItemMapping,
  MediaType,
  PlayerQueue,
} from "@/plugins/api/interfaces";

export interface WidgetRow {
  label: string;
  icon: string;
  path?: string;
  items: MediaItemTypeOrItemMapping[];
  count?: number;
  queues?: PlayerQueue[];
}

interface Props {
  widgetRow: WidgetRow;
}

const { widgetRow } = defineProps<Props>();
</script>

<style scoped>
.header.v-toolbar {
  height: 55px;
  font-family: "JetBrains Mono Medium";
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
