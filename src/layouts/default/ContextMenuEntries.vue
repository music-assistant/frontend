<template>
  <template v-for="menuItem of visibleItems" :key="menuItem.label">
    <!-- custom inline control (e.g. a stepper); renders its own row and
         manages its own interaction without closing the menu -->
    <component
      :is="menuItem.component"
      v-if="menuItem.component"
      v-bind="menuItem.componentProps"
    />
    <!-- item whose submenu replaces the menu -->
    <DropdownMenuItem
      v-else-if="inPlaceSubmenus && hasSubmenu(menuItem)"
      :class="['gap-3', { 'text-destructive': menuItem.color === 'error' }]"
      @select="emit('open-submenu', $event, menuItem)"
    >
      <ContextMenuItemIcon :icon="menuItem.icon" />
      <span class="flex-1 truncate min-w-0">{{ menuItemLabel(menuItem) }}</span>
      <ChevronRight class="ml-auto size-4" />
    </DropdownMenuItem>
    <!-- item with a submenu: a custom control, or entries that may hold
         submenus of their own -->
    <DropdownMenuSub
      v-else-if="hasSubmenu(menuItem)"
      :open="openSubmenus[menuItem.label] === true"
      @update:open="(open) => (openSubmenus[menuItem.label] = open)"
    >
      <DropdownMenuSubTrigger
        :class="['gap-3', { 'text-destructive': menuItem.color === 'error' }]"
      >
        <ContextMenuItemIcon :icon="menuItem.icon" />
        <span class="flex-1 truncate min-w-0">{{
          menuItemLabel(menuItem)
        }}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        align="start"
        :align-offset="-5"
        :side-offset="6"
        :class="menuItem.subComponent ? SUB_COMPONENT_CLASS : SUB_ENTRIES_CLASS"
      >
        <!-- a touch screen has no hover to leave a submenu by, and the
             submenu may cover its trigger -->
        <template v-if="isTouch">
          <DropdownMenuItem
            class="gap-3 text-muted-foreground"
            :aria-label="$t('back')"
            @select="closeSubmenu($event, menuItem.label)"
          >
            <ChevronLeft class="size-5 shrink-0" />
            <span class="flex-1 truncate min-w-0">{{
              menuItemLabel(menuItem)
            }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>
        <component
          :is="menuItem.subComponent"
          v-if="menuItem.subComponent"
          v-bind="menuItem.componentProps"
        />
        <ContextMenuEntries
          v-else
          :items="menuItem.subItems ?? []"
          @select="(evt, item) => emit('select', evt, item)"
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <!-- leaf item -->
    <DropdownMenuItem
      v-else
      :disabled="menuItem.disabled === true"
      :variant="menuItem.color === 'error' ? 'destructive' : 'default'"
      @select="emit('select', $event, menuItem)"
    >
      <ContextMenuItemIcon :icon="menuItem.icon" />
      <span class="flex-1 truncate min-w-0">{{ menuItemLabel(menuItem) }}</span>
      <Check v-if="menuItem.selected" class="ml-auto size-4" />
    </DropdownMenuItem>
    <DropdownMenuSeparator v-if="menuItem.separatorAfter" />
  </template>
</template>

<script setup lang="ts">
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  menuItemLabel,
  type ContextMenuItem,
} from "@/helpers/context_menu_item";
import { Check, ChevronLeft, ChevronRight } from "@lucide/vue";
import { useMediaQuery } from "@vueuse/core";
import { computed, reactive } from "vue";
import { ContextMenuItemIcon } from "./ContextMenuItemIcon";

// fixed width so popout content truncates on phones; flex column so the
// component can keep a static header and scroll the rest. capped at the
// popper's available height (not a viewport fraction) so growing content
// scrolls instead of shifting the popout up
const SUB_COMPONENT_CLASS =
  "max-h-[min(70vh,var(--reka-dropdown-menu-content-available-height))] w-[min(92vw,350px)] flex flex-col";
// capped as the menu itself, so a long entry is cut off on a phone
const SUB_ENTRIES_CLASS =
  "max-h-[70vh] max-w-[min(92vw,350px)] overflow-y-auto";

const props = defineProps<{
  items: ContextMenuItem[];
  inPlaceSubmenus?: boolean;
}>();
const emit = defineEmits<{
  select: [evt: Event, menuItem: ContextMenuItem];
  "open-submenu": [evt: Event, menuItem: ContextMenuItem];
}>();

const isTouch = useMediaQuery("(hover: none)");
const openSubmenus = reactive<Record<string, boolean>>({});

const visibleItems = computed(() => props.items.filter((x) => !x.hide));

const hasSubmenu = (item: ContextMenuItem) =>
  Boolean(item.subComponent || item.subItems?.length);

function closeSubmenu(evt: Event, label: string) {
  // keeps the rest of the menu open
  evt.preventDefault();
  openSubmenus[label] = false;
}
</script>
