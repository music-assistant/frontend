<template>
  <div
    :class="`widget-row ${
      widgetRow.settings && !widgetRow.settings.enabled ? 'disabled' : ''
    }`"
  >
    <div class="header flex items-center h-10 px-1">
      <div class="flex-1 min-w-0">
        <div class="flex items-center group">
          <span
            class="mr-3 text-lg font-bold"
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
        <Badge
          v-if="widgetRow.subtitle && getBreakpointValue('bp6')"
          variant="outline"
          class="text-xs"
        >
          {{ widgetRow.subtitle }}
        </Badge>
      </div>
      <div class="flex items-center">
        <div v-if="editMode && widgetRow.settings">
          <!-- up button -->
          <Button
            v-if="widgetRow.settings.position !== 0"
            variant="ghost"
            size="icon"
            class="enabled"
            @click="
              emit('update:settings', {
                ...widgetRow.settings,
                position: widgetRow.settings.position - 1,
              })
            "
          >
            <ChevronUp class="h-5 w-5" />
          </Button>
          <!-- down button -->
          <Button
            variant="ghost"
            size="icon"
            @click="
              emit('update:settings', {
                ...widgetRow.settings,
                position: widgetRow.settings.position + 1,
              })
            "
          >
            <ChevronDown class="h-5 w-5" />
          </Button>
          <!-- enable/disable checkbox -->
          <Button
            variant="ghost"
            size="icon"
            @click="
              emit('update:settings', {
                ...widgetRow.settings,
                enabled: !widgetRow.settings.enabled,
              })
            "
          >
            <CheckSquare v-if="widgetRow.settings.enabled" class="h-5 w-5" />
            <Square v-else class="h-5 w-5" />
          </Button>
        </div>
        <Button
          v-else-if="showActionIcon && widgetRow.icon"
          variant="ghost"
          size="icon"
          :icon="
            typeof widgetRow.icon === 'string' ? widgetRow.icon : undefined
          "
          @click="handleActionIconClick"
        >
          <component
            :is="widgetRow.icon"
            v-if="typeof widgetRow.icon !== 'string'"
            class="w-[22px] h-[22px]"
          />
        </Button>
        <provider-icon
          v-else-if="widgetRow.provider"
          :domain="widgetRow.provider"
          :size="24"
        />
      </div>
    </div>

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

      <Alert v-else>
        {{ $t("no_content") }}
      </Alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Carousel from "@/components/Carousel.vue";
import PanelviewItemCompact from "@/components/PanelviewItemCompact.vue";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaItemTypeOrItemMapping,
  MediaType,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Square,
  SquareArrowRightEnter,
} from "lucide-vue-next";
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
.carousel-wrapper {
  background-color: var(--card);
  padding: 10px;
  padding-right: 0;
  border-radius: 5px 0 0 5px;
}

.widget-row {
  margin-bottom: 10px;
  margin-left: 0px;
  padding-left: 0px;
}

@media (max-width: 575px) {
  .widget-row {
    margin-bottom: 4px;
  }

  .carousel-wrapper {
    padding: 6px;
    padding-right: 0;
  }
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
</style>
