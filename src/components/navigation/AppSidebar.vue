<script setup lang="ts">
import NavMain from "@/components/navigation/NavMain.vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getMenuItems } from "./utils/getMenuItems";

const router = useRouter();
const { t } = useI18n();

const menuItems = getMenuItems();

const navItems = computed(() => {
  return menuItems
    .filter((item) => !item.hidden)
    .map((item) => ({
      title: t(item.label),
      url: item.path,
      icon: item.icon,
    }));
});
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <div class="sidebar-header" @click="router.push('/')">
          <img
            src="@/assets/icon.svg"
            alt="Music Assistant"
            class="sidebar-header-logo"
          />
          <div class="sidebar-header-title">Music Assistant</div>
        </div>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navItems" />
    </SidebarContent>
    <SidebarFooter>
      <SidebarTrigger class="-ml-1" />
    </SidebarFooter>
  </Sidebar>
</template>

<style scoped>
.sidebar-header-logo {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  flex-shrink: 0;
}

.sidebar-header-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin: 3px 0 0 10px;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.2s ease;
}

.sidebar-header {
  display: flex;
  align-items: center;
  margin-right: 15px;
  margin: 2px 15px 8px 2px;
  gap: 6px;
  transition: all 0.3s ease;
  position: relative;
  cursor: pointer;
}

:deep([data-sidebar="group"]) {
  padding-left: 0 !important;
  padding-right: 0.5rem !important;
}

:deep([data-sidebar="menu-button"]) {
  margin-left: 0.5rem !important;
  margin-right: 0.5rem !important;
  min-height: 2.5rem !important;
}

:deep([data-sidebar="menu-button"] > svg) {
  width: 2rem !important;
  height: 2rem !important;
  margin-right: 0.5rem !important;
}

:deep([data-sidebar="menu-button"] > svg.artist-icon) {
  width: 1.5rem !important;
  height: 1.5rem !important;
  margin-right: 0.2rem !important;
}
</style>
