<template>
  <v-toolbar :color="color" class="header">
    <template v-if="icon" #prepend>
      <v-btn
        :icon="typeof icon === 'string' ? icon : undefined"
        size="small"
        :disabled="iconAction == null"
        :aria-label="toolbarIconLabel"
        :aria-hidden="toolbarIconLabel ? undefined : true"
        style="opacity: 0.8"
        @click="iconAction?.()"
      >
        <component :is="icon" v-if="typeof icon !== 'string'" class="w-6 h-6" />
      </v-btn>
    </template>

    <template #title>
      <div :class="{ 'toolbar-title-wrapper': subtitle }">
        <slot name="title">
          <button
            v-if="title || (store.mobileLayout && isDiscoverPage)"
            @click="emit('titleClicked')"
          >
            {{ title || (isDiscoverPage ? $t("discover") : "") }}
          </button>
        </slot>
        <span v-if="subtitle" class="toolbar-subtitle">{{ subtitle }}</span>
      </div>
    </template>

    <template v-if="$slots.append || menuItems?.length" #append>
      <slot name="append"></slot>
      <Button
        v-for="menuItem of directItems"
        :key="menuItem.label"
        variant="ghost"
        size="icon-lg"
        :title="menuItemLabel(menuItem)"
        :aria-label="menuItemLabel(menuItem)"
        :aria-haspopup="menuItem.subItems?.length ? 'menu' : undefined"
        :aria-pressed="menuItem.active == null ? undefined : menuItem.active"
        :disabled="menuItem.disabled == true"
        @click="(e: MouseEvent) => onMenuItemClick(e, menuItem)"
      >
        <span class="relative inline-flex">
          <MenuItemIcon :icon="menuItem.icon" :size="22" />
          <span v-if="menuItem.active" :class="ACTIVE_DOT_CLASS"></span>
        </span>
      </Button>

      <!-- overflow menu with (remaining) items if on mobile -->
      <DropdownMenu v-if="overflowItems.length" v-model:open="overflowMenuOpen">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-lg"
            :title="$t('menu')"
            :aria-label="$t('menu')"
          >
            <span class="relative inline-flex">
              <EllipsisVertical class="size-[22px]" />
              <span v-if="menuActive" :class="ACTIVE_DOT_CLASS"></span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="min-w-56">
          <template v-for="(menuItem, index) in overflowItems" :key="index">
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
                class="max-h-[70vh] overflow-y-auto"
              >
                <DropdownMenuItem
                  v-for="subItem of menuItem.subItems.filter((x) => !x.hide)"
                  :key="subItem.label"
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
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              v-else
              :disabled="menuItem.disabled == true"
              class="gap-3"
              @select="(e: Event) => e.preventDefault()"
              @click="(e: MouseEvent) => onMenuItemClick(e, menuItem)"
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
  </v-toolbar>
</template>

<script setup lang="ts">
import MenuItemIcon from "@/components/MenuItemIcon.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  menuItemLabel,
  type ContextMenuItem,
} from "@/helpers/context_menu_item";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Check, EllipsisVertical } from "@lucide/vue";
import { getBreakpointValue } from "../plugins/breakpoint";

import type { Component } from "vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  color?: string;
  icon?: string | Component;
  title?: string;
  subtitle?: string;
  menuItems?: ToolBarMenuItem[];
  enforceOverflowMenu?: boolean;
  menuActive?: boolean;
  isDiscoverPage?: boolean;
  iconAction?: () => void;
  iconLabel?: string;
}
const props = withDefaults(defineProps<Props>(), {
  color: "transparent",
  icon: undefined,
  title: undefined,
  subtitle: undefined,
  count: undefined,
  menuItems: undefined,
  enforceOverflowMenu: false,
  menuActive: false,
  iconAction: undefined,
  iconLabel: undefined,
});

const ACTIVE_DOT_CLASS =
  "bg-primary absolute -top-0.5 -right-0.5 size-1.5 rounded-full";

const overflowMenuOpen = ref(false);
const { t } = useI18n();

const directItems = computed(
  () =>
    props.menuItems?.filter(
      (x) =>
        !x.hide &&
        (x.overflowAllowed === false ||
          (!props.enforceOverflowMenu && getBreakpointValue("bp8"))),
    ) ?? [],
);

const overflowItems = computed(() =>
  !getBreakpointValue("bp8") || props.enforceOverflowMenu
    ? (props.menuItems?.filter(
        (x) => x.hide != true && x.overflowAllowed !== false,
      ) ?? [])
    : [],
);

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

const toolbarIconLabel = computed(() => {
  if (props.iconLabel) return props.iconLabel;
  if (props.title) return props.title;
  if (props.isDiscoverPage) return t("discover");
  if (props.iconAction) return t("back");
  return undefined;
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
}

.header.v-toolbar :deep(.v-toolbar__content) {
  height: 55px !important;
  min-height: 55px !important;
  padding-top: 0;
  padding-bottom: 0;
  align-items: center;
  /* anchors the centred slot */
  position: relative;
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

.toolbar-title-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  line-height: 1.2;
}

.toolbar-subtitle {
  font-size: 0.7rem;
  font-weight: 400;
  opacity: 0.6;
}
</style>
