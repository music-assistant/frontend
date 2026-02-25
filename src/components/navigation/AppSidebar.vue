<script setup lang="ts">
import NavMain from "@/components/navigation/NavMain.vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { eventbus } from "@/plugins/eventbus";
import { computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import NavMobile from "./NavMobile.vue";
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
      disabled: item.disabled,
    }));
});

const { toggleSidebar, state, isMobile } = useSidebar();
const collapsed = computed(() => state.value === "collapsed");

const handleOpenSidebar = () => {
  if (isMobile.value) {
    toggleSidebar();
  }
};

onMounted(() => {
  eventbus.on("mobile-sidebar-open", handleOpenSidebar);
});

onUnmounted(() => {
  eventbus.off("mobile-sidebar-open", handleOpenSidebar);
});
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <div class="sidebar-header-row">
          <div class="sidebar-header" @click="router.push('/')">
            <img
              src="@/assets/icon.svg"
              alt="Music Assistant"
              class="sidebar-header-logo"
            />
            <div v-if="!collapsed" class="sidebar-header-title">
              Music Assistant
            </div>
          </div>
        </div>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navItems" />
    </SidebarContent>
    <SidebarFooter>
      <NavMobile v-if="isMobile" />
      <SidebarTrigger v-else />
    </SidebarFooter>
  </Sidebar>
</template>

<style scoped>
.sidebar-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

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

.ha-header-button {
  border: none;
  background: transparent;
  padding: 0;
  margin-right: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ha-header-button:hover {
  opacity: 0.9;
}

.ha-logo-icon {
  width: 22px;
  height: 22px;
  display: block;
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
  width: 1.4rem !important;
  height: 1.4rem !important;
  margin-right: 0.3rem !important;
}
</style>

<style>
[data-mobile="true"] [data-sidebar="footer"] [data-sidebar="menu-button"] {
  margin-left: 0 !important;
}
[data-mobile="true"]
  [data-sidebar="footer"]
  [data-sidebar="menu-button"]
  > svg {
  width: 1rem !important;
  height: 1rem !important;
}
</style>
