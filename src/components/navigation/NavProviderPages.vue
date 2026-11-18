<script setup lang="ts">
import MenuItemIcon from "@/components/MenuItemIcon.vue";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  getProviderPageEntries,
  openProviderPage,
  type ProviderPageEntry,
} from "@/helpers/provider_pages";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { Puzzle } from "@lucide/vue";
import { computed, markRaw } from "vue";

const NEUTRAL_ICON = markRaw(Puzzle);

const { isMobile, setOpenMobile } = useSidebar();

const entries = computed(() =>
  getProviderPageEntries(
    Object.values(api.providers),
    api.providerManifests,
    (scope) => authManager.hasScope(scope),
  ),
);

// the icon rail shows no second line, so the tooltip names the instance
const tooltipOf = (entry: ProviderPageEntry) =>
  entry.instanceName ? `${entry.label} (${entry.instanceName})` : entry.label;

const choose = (entry: ProviderPageEntry) => {
  if (isMobile.value) setOpenMobile(false);
  void openProviderPage(entry.instanceId);
};
</script>

<template>
  <SidebarGroup v-if="entries.length">
    <SidebarGroupLabel>{{ $t("provider_pages.heading") }}</SidebarGroupLabel>
    <SidebarGroupContent>
      <SidebarMenu>
        <!-- the row gutter would skew the centred icon rail, so it lifts when
             collapsed -->
        <SidebarMenuItem
          v-for="entry in entries"
          :key="entry.instanceId"
          class="mr-1.5 group-data-[collapsible=icon]:mr-0"
        >
          <!-- grows to fit the instance's name on a second line -->
          <SidebarMenuButton
            :tooltip="tooltipOf(entry)"
            class="h-auto text-sm font-medium"
            @click="choose(entry)"
          >
            <MenuItemIcon :icon="entry.icon ?? NEUTRAL_ICON" />
            <span class="flex min-w-0 flex-col">
              <span class="truncate">{{ entry.label }}</span>
              <span
                v-if="entry.instanceName"
                class="text-muted-foreground truncate text-xs"
              >
                {{ entry.instanceName }}
              </span>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>

<style scoped>
/* the same icon size as the other sections of the menu */
:deep([data-sidebar="menu-button"] svg),
:deep([data-sidebar="menu-button"] [class*="lucide"]) {
  width: 1.2rem !important;
  height: 1.2rem !important;
  padding-right: 3px !important;
}

/* a named icon is a font glyph, which the menu's spacing for an svg misses */
:deep([data-sidebar="menu-button"] > .v-icon) {
  width: 1.2rem !important;
  height: 1.2rem !important;
  margin-right: 0.5rem !important;
  font-size: 1.2rem !important;
}
</style>
