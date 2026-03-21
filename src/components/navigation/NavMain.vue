<script setup lang="ts">
import { markRaw, ref, type Component } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

const RouterLinkComponent = markRaw(RouterLink);

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavSubItem {
  title: string;
  url: string;
  openInNewTab?: boolean;
}

interface NavItem {
  title: string;
  url: string;
  icon?: Component;
  disabled?: boolean;
  openInNewTab?: boolean;
  subItems?: NavSubItem[];
}

const props = defineProps<{
  items: NavItem[];
}>();

const route = useRoute();
const router = useRouter();
const { isMobile, setOpenMobile } = useSidebar();

const showMenu = ref(false);
const menuPosX = ref(0);
const menuPosY = ref(0);
const activeSubItems = ref<NavSubItem[]>([]);

const isActive = (url: string) =>
  route.path === url || route.path.startsWith(url + "/");

const handleClick = (item: NavItem, event: Event) => {
  if (item.subItems && item.subItems.length > 0) {
    event.preventDefault();
    const mouseEvent = event as MouseEvent;
    menuPosX.value = mouseEvent.clientX;
    menuPosY.value = mouseEvent.clientY;
    activeSubItems.value = item.subItems;
    showMenu.value = true;
    return;
  }
  if (item.openInNewTab) {
    event.preventDefault();
    const resolved = router.resolve(item.url).href;
    const fullUrl = new URL(resolved, window.location.href).href;
    window.open(fullUrl, "_blank");
  }
  if (isMobile.value) {
    setOpenMobile(false);
  }
};

const handleSubItemClick = (subItem: NavSubItem) => {
  showMenu.value = false;
  if (subItem.openInNewTab) {
    const resolved = router.resolve(subItem.url).href;
    const fullUrl = new URL(resolved, window.location.href).href;
    window.open(fullUrl, "_blank");
  } else {
    router.push(subItem.url);
  }
  if (isMobile.value) {
    setOpenMobile(false);
  }
};
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent class="flex flex-col gap-0.5">
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.title" class="mr-1.5">
          <SidebarMenuButton
            :as="
              item.disabled || item.openInNewTab || item.subItems?.length
                ? 'button'
                : RouterLinkComponent
            "
            v-bind="
              item.disabled || item.openInNewTab || item.subItems?.length
                ? {}
                : { to: item.url }
            "
            :is-active="isActive(item.url)"
            :tooltip="item.title"
            :disabled="item.disabled"
            :class="[
              isActive(item.url)
                ? 'no-underline font-bold text-sm'
                : 'no-underline font-medium text-sm',
              item.disabled ? 'opacity-50 cursor-not-allowed' : '',
            ]"
            @click="(e: Event) => handleClick(item, e)"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              class="mr-1"
              :stroke-width="isActive(item.url) ? 2.5 : 2"
            />
            <span>{{ item.title }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>

  <v-menu
    v-model="showMenu"
    :target="[menuPosX, menuPosY]"
    scrim
    z-index="999999"
  >
    <v-card min-width="200" style="overflow-y: auto">
      <v-list density="compact" slim tile>
        <v-list-item
          v-for="subItem in activeSubItems"
          :key="subItem.url"
          :title="subItem.title"
          link
          style="padding-left: 16px"
          @click="handleSubItemClick(subItem)"
        />
      </v-list>
    </v-card>
  </v-menu>
</template>

<style scoped>
:deep(a) {
  text-decoration: none !important;
  color: inherit !important;
}

:deep(a:hover) {
  text-decoration: none !important;
}

:deep(a:visited) {
  color: inherit !important;
}

:deep([data-sidebar="menu-button"] > svg),
:deep([data-sidebar="menu-button"] svg),
:deep([data-sidebar="menu-button"] [class*="lucide"]) {
  width: 1.2rem !important;
  height: 1.2rem !important;
  padding-right: 3px !important;
}

:deep([data-sidebar="menu-item"]) {
  display: flex !important;
  flex-direction: column !important;
}
</style>
