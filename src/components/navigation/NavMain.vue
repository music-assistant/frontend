<script setup lang="ts">
import { markRaw, type Component } from "vue";
import { RouterLink, useRoute } from "vue-router";

const RouterLinkComponent = markRaw(RouterLink);

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon?: Component;
  disabled?: boolean;
}

const props = defineProps<{
  items: NavItem[];
}>();

const route = useRoute();
const { isMobile, setOpenMobile } = useSidebar();

const isActive = (url: string) =>
  route.path === url || route.path.startsWith(url + "/");

const handleClick = () => {
  if (isMobile.value) {
    setOpenMobile(false);
  }
};
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent class="flex flex-col gap-2">
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.title" class="mr-1.5">
          <SidebarMenuButton
            :as="item.disabled ? 'button' : RouterLinkComponent"
            v-bind="item.disabled ? {} : { to: item.url }"
            :is-active="isActive(item.url)"
            :tooltip="item.title"
            :disabled="item.disabled"
            :class="[
              isActive(item.url)
                ? 'no-underline font-bold text-sm'
                : 'no-underline font-medium text-sm',
              item.disabled ? 'opacity-50 cursor-not-allowed' : '',
            ]"
            @click="handleClick"
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
