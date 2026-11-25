<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <!-- capped as the menu of an item, so a long entry is cut off on a phone -->
    <DropdownMenuContent align="end" class="min-w-56 max-w-[350px]">
      <template v-for="(menuItem, index) in items" :key="index">
        <DropdownMenuSub v-if="menuItem.subItems?.length">
          <DropdownMenuSubTrigger
            class="gap-3"
            :disabled="menuItem.disabled == true"
          >
            <span class="relative inline-flex">
              <MenuItemIcon :icon="menuItem.icon" />
              <span v-if="menuItem.active" :class="ACTIVE_DOT_CLASS"></span>
            </span>
            <span class="min-w-0 flex-1 truncate">{{
              menuItemLabel(menuItem)
            }}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            align="start"
            :align-offset="-5"
            :side-offset="6"
            class="max-h-[70vh] min-w-56 max-w-[min(92vw,350px)] overflow-y-auto"
          >
            <template
              v-for="subItem of menuItem.subItems.filter((x) => !x.hide)"
              :key="subItem.label"
            >
              <!-- custom inline control; renders its own row and manages
                   its own interaction without closing the menu -->
              <component
                :is="subItem.component"
                v-if="subItem.component"
                v-bind="subItem.componentProps"
              />
              <DropdownMenuItem
                v-else
                :disabled="subItem.disabled === true"
                class="gap-3"
                @select="(e: Event) => onSubItemSelect(e, menuItem, subItem)"
              >
                <MenuItemIcon :icon="subItem.icon" />
                <span class="min-w-0 flex-1 truncate">{{
                  menuItemLabel(subItem)
                }}</span>
                <Check v-if="subItem.selected" class="ml-auto size-4" />
              </DropdownMenuItem>
              <DropdownMenuSeparator v-if="subItem.separatorAfter" />
            </template>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          v-else
          :disabled="menuItem.disabled == true"
          class="gap-3"
          @select="(e: Event) => e.preventDefault()"
          @click="(e: MouseEvent) => onItemClick(e, menuItem)"
        >
          <span class="relative inline-flex">
            <MenuItemIcon :icon="menuItem.icon" />
            <span v-if="menuItem.active" :class="ACTIVE_DOT_CLASS"></span>
          </span>
          <span class="min-w-0 flex-1 truncate">{{
            menuItemLabel(menuItem)
          }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { ACTIVE_DOT_CLASS } from "@/constants";
import MenuItemIcon from "@/components/MenuItemIcon.vue";
import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  menuItemLabel,
  type ContextMenuItem,
} from "@/helpers/context_menu_item";
import { Check } from "@lucide/vue";
import { ref } from "vue";

/**
 * A menu of toolbar items, opened by the button in its slot: each item with its
 * icon, a dot by an item that is on, and the submenu of an item that has one.
 */
defineProps<{
  items: readonly ToolBarMenuItem[];
}>();

const open = ref(false);

const onSubItemSelect = (
  event: Event,
  parent: ToolBarMenuItem,
  subItem: ContextMenuItem,
) => {
  if (
    parent.closeOnContentClick === false ||
    subItem.close_on_click === false
  ) {
    event.preventDefault();
  }
  subItem.action?.();
};

const onItemClick = (event: MouseEvent, menuItem: ToolBarMenuItem) => {
  event.preventDefault();
  if (!menuItem.action) return;
  // Close overflow menu before executing action
  open.value = false;
  menuItem.action();
};
</script>
