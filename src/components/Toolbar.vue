<template>
  <div class="header flex items-center h-[55px] px-0" :style="color !== 'transparent' ? { backgroundColor: color } : undefined">
    <div v-if="icon" class="ml-3 mr-0">
      <Button
        variant="ghost"
        size="icon"
        :disabled="iconAction == null"
        class="opacity-80"
        @click="iconAction?.()"
      >
        <component :is="icon" v-if="typeof icon !== 'string'" class="w-6 h-6" />
      </Button>
    </div>

    <div class="flex-1 ml-2.5 min-w-0 font-['JetBrains_Mono_Medium']">
      <slot name="title">
        <button
          v-if="title || (store.mobileLayout && isDiscoverPage)"
          @click="emit('titleClicked')"
        >
          {{ title || (isDiscoverPage ? $t("discover") : "") }}
        </button>
      </slot>
    </div>

    <div v-if="$slots.append || menuItems?.length" class="flex items-center mr-1.5">
      <slot name="append"></slot>
      <Button
        v-for="menuItem of menuItems?.filter(
          (x) =>
            !x.hide &&
            !enforceOverflowMenu &&
            (getBreakpointValue('bp8') || x.overflowAllowed === false),
        )"
        :key="menuItem.label"
        variant="ghost"
        size="icon"
        class="w-10"
        :title="$t(menuItem.label, menuItem.labelArgs || [])"
        :disabled="menuItem.disabled == true"
        @click="(e: MouseEvent) => onMenuItemClick(e, menuItem)"
      >
        <span class="relative inline-flex">
          <component
            :is="typeof menuItem.icon === 'string' ? resolveIconHelper(menuItem.icon) : menuItem.icon"
            v-if="menuItem.icon"
            class="w-[22px] h-[22px]"
          />
          <span
            v-if="menuItem.active == true"
            class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary"
          />
        </span>
      </Button>

      <!-- overflow menu with (remaining) items if on mobile -->
      <DropdownMenu
        v-if="
          (!getBreakpointValue('bp8') || enforceOverflowMenu) &&
          menuItems?.filter(
            (x) => x.hide != true && x.overflowAllowed !== false,
          ).length
        "
        v-model:open="overflowMenuOpen"
      >
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="w-4 -ml-2.5"
          >
            <MoreVertical class="w-[22px] h-[22px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            v-for="(menuItem, index) in menuItems?.filter(
              (x) => x.hide != true && x.overflowAllowed != false,
            )"
            :key="index"
            :disabled="menuItem.disabled == true"
            @click.prevent.stop="
              (e: MouseEvent | KeyboardEvent) => onMenuItemClick(e, menuItem)
            "
          >
            <span v-if="menuItem.icon" class="relative inline-flex mr-2">
              <component
                :is="typeof menuItem.icon === 'string' ? resolveIconHelper(menuItem.icon) : menuItem.icon"
                v-if="menuItem.icon"
                class="w-[22px] h-[22px]"
              />
              <span
                v-if="menuItem.active == true"
                class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary"
              />
            </span>
            <span>{{ $t(menuItem.label, menuItem.labelArgs || []) }}</span>
            <ChevronRight v-if="menuItem.subItems?.length" class="ml-auto h-4 w-4" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { getBreakpointValue } from "../plugins/breakpoint";
import { resolveIcon as resolveIconHelper } from "@/helpers/iconMapping";
import { ChevronRight, MoreVertical } from "lucide-vue-next";

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
.header {
  height: 55px;
  min-height: 55px;
}

/* Mobile branding on the left */
.toolbar-prepend {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
