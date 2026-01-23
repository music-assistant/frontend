<script setup lang="ts">
import NavMain from "@/components/navigation/NavMain.vue";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { haState, toggleHAMenuVisibility } from "@/plugins/homeassistant";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getMenuItems } from "./utils/getMenuItems";

const router = useRouter();
const { t } = useI18n();
const { state, isMobile } = useSidebar();

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

const isCollapsed = computed(() => state.value === "collapsed");

const haButtonText = computed(() => {
  return haState.kioskModeEnabled ? "Show HA Menu" : "Hide HA Menu";
});

const haButtonTooltip = computed(() => {
  return haState.kioskModeEnabled
    ? "Show Home Assistant Menu"
    : "Hide Home Assistant Menu";
});

const handleHAMenuToggle = () => {
  toggleHAMenuVisibility();
};
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
      <!-- HA Menu Toggle Button (only in ingress/app session) -->
      <div class="px-2 w-full mb-2">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              :class="[
                'home-assistant-button w-full justify-start',
                isCollapsed && 'home-assistant-collapsed',
              ]"
              @click="handleHAMenuToggle"
            >
              <img
                src="@/assets/home-assistant-logo.svg"
                alt="Home Assistant"
                class="home-assistant-icon"
              />
              <span class="home-assistant-text">{{ haButtonText }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="center"
            :hidden="state !== 'collapsed' || isMobile"
          >
            {{ haButtonTooltip }}
          </TooltipContent>
        </Tooltip>
      </div>
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

.home-assistant-button {
  transition: all 0.2s ease;
  padding-left: 8px !important;
}

.home-assistant-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  transition: all 0.2s ease;
}

.home-assistant-text {
  transition:
    opacity 0.2s ease,
    width 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  margin-left: 0.5rem;
}

.home-assistant-collapsed {
  display: inline-flex;
  align-items: center;
  justify-content: center !important;
  padding-right: 7px !important;
}

.home-assistant-collapsed .home-assistant-icon {
  margin: 0 auto;
}

.home-assistant-collapsed .home-assistant-text {
  opacity: 0;
  width: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
