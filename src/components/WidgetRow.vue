<template>
  <div
    :class="`widget-row ${
      widgetRow.settings && !widgetRow.settings.enabled ? 'disabled' : ''
    }`"
  >
    <v-toolbar class="header" color="transparent">
      <template #title>
        <div class="flex items-center group">
          <span
            class="mr-3"
            :class="{
              'cursor-pointer group-hover:opacity-70':
                showActionIcon && widgetRow.action,
            }"
            @click="showActionIcon && handleActionIconClick()"
            >{{ widgetRow.title }}</span
          >
          <SquareArrowRightEnter
            v-if="showActionIcon && widgetRow.action"
            :size="18"
            class="cursor-pointer group-hover:opacity-70"
            @click="handleActionIconClick"
          />
        </div>
        <v-chip
          v-if="widgetRow.subtitle && getBreakpointValue('bp6')"
          inline
          outlined
          :text="widgetRow.subtitle"
          density="compact"
          size="small"
        />
      </template>
      <template #append>
        <div v-if="editMode && widgetRow.settings">
          <!-- up button -->
          <v-btn
            v-if="widgetRow.settings.position !== 0"
            icon="mdi-chevron-up"
            class="enabled"
            @click="
              emit('update:settings', {
                ...widgetRow.settings,
                position: widgetRow.settings.position - 1,
              })
            "
          />
          <!-- down button -->
          <v-btn
            icon="mdi-chevron-down"
            @click="
              emit('update:settings', {
                ...widgetRow.settings,
                position: widgetRow.settings.position + 1,
              })
            "
          />
          <!-- enable/disable checkbox -->
          <v-btn
            :icon="
              widgetRow.settings.enabled
                ? 'mdi-checkbox-marked'
                : 'mdi-checkbox-blank-outline'
            "
            @click="
              emit('update:settings', {
                ...widgetRow.settings,
                enabled: !widgetRow.settings.enabled,
              })
            "
          />
        </div>
        <v-btn
          v-else-if="showActionIcon && widgetRow.icon"
          :icon="
            typeof widgetRow.icon === 'string' ? widgetRow.icon : undefined
          "
          variant="text"
          @click="handleActionIconClick"
        >
          <component
            :is="widgetRow.icon"
            v-if="typeof widgetRow.icon !== 'string'"
            class="w-[22px] h-[22px]"
          />
        </v-btn>
        <provider-icon
          v-else-if="widgetRow.provider"
          :domain="widgetRow.provider"
          :size="24"
        />
      </template>
    </v-toolbar>

    <div class="carousel-wrapper">
      <carousel v-if="widgetRow.items.length > 0">
        <swiper-slide v-for="item in widgetRow.items" :key="item.uri">
          <PanelviewItemCompact
            :item="item"
            :show-provider-on-cover="showProviderOnCover"
            :permanent-overlay="
              ![MediaType.ALBUM, MediaType.TRACK, MediaType.RADIO].includes(
                item.media_type,
              )
            "
            :is-available="itemIsAvailable(item)"
            :disabled="editMode"
          />
        </swiper-slide>
      </carousel>

      <v-alert v-else>
        {{ $t("no_content") }}
      </v-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import Carousel from "@/components/Carousel.vue";
import PanelviewItemCompact from "@/components/PanelviewItemCompact.vue";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaItemTypeOrItemMapping,
  MediaType,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { SquareArrowRightEnter } from "lucide-vue-next";
import type { Component } from "vue";
import ProviderIcon from "./ProviderIcon.vue";

export interface WidgetRowSettings {
  position: number;
  enabled: boolean;
}

export interface WidgetRow {
  title: string;
  icon?: string | Component;
  action?: () => void;
  uri?: string;
  items: MediaItemTypeOrItemMapping[];
  subtitle?: string;
  provider?: string;
  settings?: WidgetRowSettings;
}

interface Props {
  widgetRow: WidgetRow;
  editMode?: boolean;
  showProviderOnCover?: boolean;
  showActionIcon?: boolean;
}

const emit = defineEmits(["update:settings"]);

const { widgetRow, showProviderOnCover, showActionIcon } = defineProps<Props>();

const handleActionIconClick = () => {
  widgetRow.action && widgetRow.action();
};
</script>

<style scoped>
.header.v-toolbar :deep(.v-toolbar-title) {
  margin-inline-start: 0px;
  font-size: x-large;
  font-weight: bold;
}

.carousel-wrapper {
  background-color: rgb(var(--v-theme-panel));
  padding: 10px;
  border-radius: 5px;
}

.widget-row {
  margin-bottom: 20px;
  margin-left: 0px;
  padding-left: 0px;
}

.disabled {
  opacity: 0.2;
}
.enabled {
  opacity: 1;
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
