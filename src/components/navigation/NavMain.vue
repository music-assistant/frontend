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
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon?: Component;
}

const props = defineProps<{
  items: NavItem[];
}>();

const route = useRoute();

const isActive = (url: string) => {
  return route.path === url || route.path.startsWith(url + "/");
};
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent class="flex flex-col gap-2">
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.title" class="mr-1.5">
          <SidebarMenuButton
            :as="RouterLinkComponent"
            v-bind="{ to: item.url }"
            :is-active="isActive(item.url)"
            :tooltip="item.title"
            class="no-underline font-semibold text-sm"
          >
            <component :is="item.icon" v-if="item.icon" class="mr-1" />
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
</style>
