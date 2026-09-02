<script setup lang="ts">
import NavMain from "@/components/navigation/NavMain.vue";
import NavShortcuts from "@/components/navigation/NavShortcuts.vue";
import AppLogo from "@/components/AppLogo.vue";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  commandCenterHotkeyLabel,
  useCommandCenter,
} from "@/composables/useCommandCenter";
import { useThemePreference } from "@/composables/useThemePreference";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { haState } from "@/plugins/homeassistant";
import { store } from "@/plugins/store";
import { Check, LogOut, Moon, PanelLeft, Sun } from "@lucide/vue";
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import NavHomeAssistant from "./NavHomeAssistant.vue";
import NavHeaderMenu from "./NavHeaderMenu.vue";
import NavUser from "./NavUser.vue";
import {
  getMenuItems,
  resolveMenuConfig,
  type MenuGroup,
} from "./utils/getMenuItems";

const router = useRouter();
const { t } = useI18n();
const { open: openCommandCenter } = useCommandCenter();

const editMode = computed(() => store.navMenuEditMode);

const navItems = computed(() =>
  getMenuItems()
    // Edit mode lists every (available) item so hidden ones can be re-enabled.
    .filter((item) => editMode.value || !item.hidden)
    .map((item) => ({
      id: item.id,
      title: t(item.label),
      url: item.path,
      icon: item.icon,
      disabled: editMode.value ? undefined : item.disabled,
      hidden: item.hidden,
      group: item.group,
      action:
        item.action === "command-center"
          ? () => openCommandCenter()
          : undefined,
      shortcut:
        item.action === "command-center" && !isMobile.value
          ? commandCenterHotkeyLabel
          : undefined,
    })),
);

const discoverItems = computed(() =>
  navItems.value.filter((item) => item.group === "explore"),
);
const libraryItems = computed(() =>
  navItems.value.filter((item) => item.group === "library"),
);
const pluginItems = computed(() =>
  navItems.value.filter((item) => item.group === "plugins"),
);
const systemItems = computed(() =>
  navItems.value.filter((item) => item.group === "system"),
);

const DEFAULT_SECTION_LABELS: Record<MenuGroup, string> = {
  explore: "explore",
  library: "library",
  plugins: "plugins",
  system: "system",
};

const sections = computed(() => {
  const sectionConfigs = resolveMenuConfig().sections;
  const resolved = {} as Record<
    MenuGroup,
    { label: string; defaultLabel: string; labelHidden: boolean }
  >;
  for (const [group, labelKey] of Object.entries(DEFAULT_SECTION_LABELS)) {
    const cfg = sectionConfigs[group as MenuGroup] ?? {};
    const defaultLabel = t(labelKey);
    resolved[group as MenuGroup] = {
      label: cfg.label || defaultLabel,
      defaultLabel,
      labelHidden: !!cfg.hide_label,
    };
  }
  return resolved;
});

const { toggleSidebar, setOpen, state, isMobile, setOpenMobile } = useSidebar();
const { isDarkTheme, setThemePreference } = useThemePreference();
const collapsed = computed(() => state.value === "collapsed");
const themeToggleLabel = computed(() =>
  t(`settings.theme.options.${isDarkTheme.value ? "light" : "dark"}`),
);

// Editing needs the full (labeled) menu, so pop the sidebar open when edit
// mode is entered from anywhere (profile menu, settings page shortcut), and
// treat collapsing to icon mode as leaving edit mode.
watch(editMode, (editing) => {
  if (editing && !isMobile.value) setOpen(true);
});
watch(collapsed, (isCollapsed) => {
  if (isCollapsed && store.navMenuEditMode) store.navMenuEditMode = false;
});

const handleOpenSidebar = () => {
  if (isMobile.value) {
    toggleSidebar();
  }
};

const toggleTheme = () =>
  setThemePreference(isDarkTheme.value ? "light" : "dark");

const handleFooterLogout = () => {
  if (isMobile.value) {
    setOpenMobile(false);
  }
  authManager.logout();
};

onMounted(() => {
  eventbus.on("mobile-sidebar-open", handleOpenSidebar);
});

onUnmounted(() => {
  eventbus.off("mobile-sidebar-open", handleOpenSidebar);
  store.navMenuEditMode = false;
});
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader
      class="h-16 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:pb-0"
    >
      <SidebarMenu class="group-data-[collapsible=icon]:gap-2">
        <SidebarMenuItem>
          <div
            class="flex w-full items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center"
          >
            <div
              class="relative flex min-w-0 cursor-pointer items-center gap-1.5 transition-opacity duration-300 ease-[ease]"
              @click="router.push('/')"
            >
              <AppLogo />
              <div
                v-if="!collapsed"
                class="mt-[3px] ml-2.5 overflow-hidden text-[1.2rem] font-bold whitespace-nowrap transition-opacity duration-200 ease-[ease]"
              >
                Music Assistant
              </div>
            </div>
            <Button
              v-if="editMode"
              variant="ghost"
              size="icon-lg"
              class="shrink-0"
              :title="t('menu_edit_disable')"
              :aria-label="t('menu_edit_disable')"
              data-testid="sidebar-edit-done"
              @click="store.navMenuEditMode = false"
            >
              <Check class="size-4" />
            </Button>
            <NavHeaderMenu v-else-if="!collapsed" />
          </div>
        </SidebarMenuItem>
        <SidebarMenuItem v-if="collapsed" class="flex w-full items-center">
          <NavHeaderMenu />
        </SidebarMenuItem>
        <!-- Search goes here. -->
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent class="scroll-fade">
      <NavMain
        :items="discoverItems"
        :label="sections.explore.label"
        :default-label="sections.explore.defaultLabel"
        section-id="explore"
        :edit-mode="editMode"
        separator="collapsed"
      />
      <NavMain
        :items="libraryItems"
        :label="sections.library.label"
        :default-label="sections.library.defaultLabel"
        :label-hidden="sections.library.labelHidden"
        section-id="library"
        :edit-mode="editMode"
        separator="always"
      />
      <NavMain
        :items="pluginItems"
        :label="sections.plugins.label"
        :default-label="sections.plugins.defaultLabel"
        :label-hidden="sections.plugins.labelHidden"
        section-id="plugins"
        :edit-mode="editMode"
        separator="always"
      />
      <NavMain
        :items="systemItems"
        :label="sections.system.label"
        :default-label="sections.system.defaultLabel"
        :label-hidden="sections.system.labelHidden"
        section-id="system"
        :edit-mode="editMode"
        separator="always"
      />
      <NavShortcuts :edit-mode="editMode" />
    </SidebarContent>
    <SidebarFooter
      class="h-16 pb-3 pr-5 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:pb-3 group-data-[collapsible=icon]:pr-0"
    >
      <!-- Kiosk mode leaves no Home Assistant chrome on screen, so this is the
           only way back to it. -->
      <NavHomeAssistant v-if="haState.kioskModeEnabled" />
      <div
        v-else
        class="flex w-full items-center pt-1 [&>button]:rounded-md"
        :class="[
          collapsed ? 'flex-col' : 'flex-row',
          'group-data-[collapsible=icon]:gap-2',
        ]"
      >
        <Button
          v-if="collapsed"
          variant="ghost"
          size="icon"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
          data-testid="sidebar-footer-collapse"
          class="basis-auto shrink-0 grow-0"
          @click="toggleSidebar"
        >
          <PanelLeft />
        </Button>
        <NavUser class="min-w-0 flex-1" />
        <div v-if="!collapsed" class="flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
            data-testid="sidebar-footer-collapse"
            class="basis-auto shrink-0 grow-0"
            @click="toggleSidebar"
          >
            <PanelLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :title="themeToggleLabel"
            :aria-label="themeToggleLabel"
            data-testid="sidebar-footer-theme"
            class="basis-auto shrink-0 grow-0"
            @click="toggleTheme"
          >
            <Sun v-if="isDarkTheme" />
            <Moon v-else />
          </Button>
          <Button
            v-if="!store.isIngressSession"
            variant="ghost"
            size="icon"
            title="Sign out"
            aria-label="Sign out"
            data-testid="sidebar-footer-logout"
            class="basis-auto shrink-0 grow-0"
            @click="handleFooterLogout"
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </SidebarFooter>
  </Sidebar>
</template>

<style scoped></style>

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
