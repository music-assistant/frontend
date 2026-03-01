<template>
  <v-toolbar :color="color" class="header">
    <template v-if="icon" #prepend>
      <v-btn
        :icon="typeof icon === 'string' ? icon : undefined"
        size="small"
        :disabled="iconAction == null"
        style="opacity: 0.8"
        @click="iconAction?.()"
      >
        <component :is="icon" v-if="typeof icon !== 'string'" class="w-6 h-6" />
      </v-btn>
    </template>

    <template #title>
      <slot name="title">
        <button
          v-if="title || (store.mobileLayout && isDiscoverPage)"
          @click="emit('titleClicked')"
        >
          {{ title || (isDiscoverPage ? $t("discover") : "") }}
        </button>
      </slot>
    </template>

    <template v-if="$slots.append" #append>
      <slot name="append"></slot>
    </template>
    <template v-else-if="menuItems?.length" #append>
      <v-btn
        v-for="menuItem of menuItems.filter(
          (x) =>
            !x.hide &&
            !enforceOverflowMenu &&
            (getBreakpointValue('bp7') || x.overflowAllowed === false),
        )"
        :key="menuItem.label"
        variant="text"
        style="width: 40px"
        :title="$t(menuItem.label, menuItem.labelArgs || [])"
        :disabled="menuItem.disabled == true"
        @click="(e: MouseEvent) => onMenuItemClick(e, menuItem)"
      >
        <v-badge :model-value="menuItem.active == true" color="primary" dot>
          <v-icon
            v-if="typeof menuItem.icon === 'string'"
            :icon="menuItem.icon"
            :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
            size="22px"
          />
          <component
            :is="menuItem.icon"
            v-else-if="menuItem.icon"
            class="w-[22px] h-[22px]"
            :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
          />
        </v-badge>
      </v-btn>

      <!-- overflow menu with (remaining) items if on mobile -->
      <div
        v-if="
          (!getBreakpointValue('bp7') || enforceOverflowMenu) &&
          menuItems.filter((x) => x.hide != true && x.overflowAllowed !== false)
            .length
        "
      >
        <v-menu
          v-model="overflowMenuOpen"
          location="bottom end"
          scrim
          :close-on-content-click="false"
        >
          <template #activator="{ props }">
            <v-btn
              variant="plain"
              style="width: 15px; margin-left: -10px"
              v-bind="props"
            >
              <v-icon
                icon="mdi-dots-vertical"
                :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
                size="22"
                style="margin-right: -5px; width: 15px"
              />
            </v-btn>
          </template>
          <v-list density="compact" slim tile>
            <v-list-item
              v-for="(menuItem, index) in menuItems.filter(
                (x) => x.hide != true && x.overflowAllowed != false,
              )"
              :key="index"
              :title="$t(menuItem.label, menuItem.labelArgs || [])"
              :disabled="menuItem.disabled == true"
              :append-icon="
                menuItem.subItems?.length ? 'mdi-chevron-right' : undefined
              "
              @click.prevent.stop="
                (e: MouseEvent | KeyboardEvent) => onMenuItemClick(e, menuItem)
              "
            >
              <template v-if="menuItem.icon" #prepend>
                <v-badge
                  :model-value="menuItem.active == true"
                  color="primary"
                  dot
                >
                  <v-icon
                    v-if="typeof menuItem.icon === 'string'"
                    :icon="menuItem.icon"
                    :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
                    size="22px"
                  />
                  <component
                    :is="menuItem.icon"
                    v-else
                    class="w-[22px] h-[22px]"
                    :color="$vuetify.theme.current.dark ? '#fff' : '#000'"
                  />
                </v-badge>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-toolbar>
</template>

<script setup lang="ts">
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { getBreakpointValue } from "../plugins/breakpoint";

import type { Component } from "vue";
import { ref } from "vue";

const overflowMenuOpen = ref(false);

const onMenuItemClick = (
  event: MouseEvent | KeyboardEvent,
  menuItem: ToolBarMenuItem,
) => {
  event.preventDefault();
  if (menuItem.subItems?.length) {
    // Open submenu via global context menu
    // Map closeOnContentClick to close_on_click on subItems if needed
    const items =
      menuItem.closeOnContentClick === false
        ? menuItem.subItems.map((item) => ({
            ...item,
            close_on_click: item.close_on_click ?? false,
          }))
        : menuItem.subItems;
    const posX = "clientX" in event ? event.clientX : 0;
    const posY = "clientY" in event ? event.clientY : 0;
    eventbus.emit("contextmenu", {
      items,
      posX,
      posY,
    });
  } else if (menuItem.action) {
    // Close overflow menu before executing action
    overflowMenuOpen.value = false;
    // Execute direct action
    menuItem.action();
  }
};

// properties
interface Props {
  color?: string;
  icon?: string | Component;
  title?: string;
  menuItems?: ToolBarMenuItem[];
  enforceOverflowMenu?: boolean;
  isDiscoverPage?: boolean;
  iconAction?: () => void;
}
withDefaults(defineProps<Props>(), {
  color: "transparent",
  icon: undefined,
  title: undefined,
  count: undefined,
  menuItems: undefined,
  enforceOverflowMenu: false,
  iconAction: undefined,
});

// emitters
const emit = defineEmits<{
  (e: "iconClicked"): void;
  (e: "titleClicked"): void;
}>();
</script>

<script lang="ts">
export interface ToolBarMenuItem extends ContextMenuItem {
  active?: boolean;
  subItems?: ContextMenuItem[];
  overflowAllowed?: boolean;
  closeOnContentClick?: boolean;
}
</script>

<style scoped>
.header.v-toolbar {
  height: 55px;
  font-family: "JetBrains Mono Medium";
}

.header.v-toolbar :deep(.v-toolbar__content) {
  height: 55px !important;
  min-height: 55px !important;
  padding-top: 0;
  padding-bottom: 0;
  align-items: center;
}

.header.v-toolbar :deep(.v-toolbar-title) {
  margin-inline-start: 10px !important;
}

.header.v-toolbar :deep(.v-toolbar__prepend) {
  margin-inline-start: 12px !important;
  margin-inline-end: 0px !important;
}

.header.v-toolbar > .v-toolbar__content > .v-toolbar__append {
  margin-inline-end: 5px;
}

.header.v-toolbar-default > .v-toolbar__content > .v-toolbar__append {
  margin-inline-end: 10px;
}

/* Mobile branding on the left */
.toolbar-prepend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
