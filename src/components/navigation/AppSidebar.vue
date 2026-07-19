<script setup lang="ts">
import NavMain from "@/components/navigation/NavMain.vue";
import NavShortcuts from "@/components/navigation/NavShortcuts.vue";
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
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Check } from "@lucide/vue";
import { computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import NavMobile from "./NavMobile.vue";
import {
  getMenuItems,
  resolveMenuConfig,
  type MenuGroup,
} from "./utils/getMenuItems";

const router = useRouter();
const { t } = useI18n();

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
    })),
);

const discoverItems = computed(() =>
  navItems.value.filter((item) => item.group === "explore"),
);
const libraryItems = computed(() =>
  navItems.value.filter((item) => item.group === "library"),
);
const systemItems = computed(() =>
  navItems.value.filter((item) => item.group === "system"),
);

const DEFAULT_SECTION_LABELS: Record<MenuGroup, string> = {
  explore: "explore",
  library: "library",
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

const { toggleSidebar, setOpen, state, isMobile } = useSidebar();
const collapsed = computed(() => state.value === "collapsed");

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
    <SidebarHeader>
      <SidebarMenu>
        <div class="sidebar-header-row">
          <div
            class="sidebar-header"
            :style="{ marginLeft: collapsed ? '2px' : '7px' }"
            @click="router.push('/')"
          >
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
      <NavMain
        :items="discoverItems"
        :label="sections.explore.label"
        :default-label="sections.explore.defaultLabel"
        :label-hidden="sections.explore.labelHidden"
        section-id="explore"
        :edit-mode="editMode"
      />
      <NavMain
        :items="libraryItems"
        :label="sections.library.label"
        :default-label="sections.library.defaultLabel"
        :label-hidden="sections.library.labelHidden"
        section-id="library"
        :edit-mode="editMode"
      />
      <NavMain
        :items="systemItems"
        :label="sections.system.label"
        :default-label="sections.system.defaultLabel"
        :label-hidden="sections.system.labelHidden"
        section-id="system"
        :edit-mode="editMode"
      />
      <NavShortcuts :edit-mode="editMode" />
    </SidebarContent>
    <SidebarFooter>
      <Button
        v-if="editMode"
        class="menu-edit-done"
        @click="store.navMenuEditMode = false"
      >
        <Check class="size-4" />
        {{ t("menu_edit_disable") }}
      </Button>
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
  margin: 2px 15px 8px 0;
  gap: 6px;
  transition: opacity 0.3s ease;
  position: relative;
  cursor: pointer;
}

.menu-edit-done {
  width: 100%;
  border-radius: 999px;
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
  padding-top: 0.125rem !important;
  padding-bottom: 0.125rem !important;
}

:deep([data-sidebar="group-label"]) {
  height: 1.75rem !important;
  padding-left: 1rem !important;
  font-family: "JetBrains Mono Medium", ui-monospace, monospace !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
  letter-spacing: 0.01em !important;
  color: hsl(var(--sidebar-foreground)) !important;
  opacity: 0.55;
}

:deep([data-sidebar="menu-button"]) {
  margin-left: 0.5rem !important;
  margin-right: 0.5rem !important;
  min-height: 1.75rem !important;
  padding-top: 0.125rem !important;
  padding-bottom: 0.125rem !important;
}

:deep([data-sidebar="menu-button"] > svg) {
  width: 1.6rem !important;
  height: 1.6rem !important;
  margin-right: 0.5rem !important;
}

:deep([data-sidebar="menu-button"] > svg.artist-icon) {
  width: 1.2rem !important;
  height: 1.2rem !important;
  margin-right: 0.3rem !important;
}

:deep([data-sidebar="menu-button"] > svg.genre-icon) {
  width: auto !important;
  height: auto !important;
  margin-right: 0.3rem !important;
}

@media (min-height: 700px) {
  :deep([data-sidebar="menu-button"]) {
    min-height: 2.25rem !important;
    padding-top: 0.375rem !important;
    padding-bottom: 0.375rem !important;
  }

  :deep([data-sidebar="menu-button"] > svg) {
    width: 2rem !important;
    height: 2rem !important;
  }

  :deep([data-sidebar="menu-button"] > svg.artist-icon) {
    width: 1.4rem !important;
    height: 1.4rem !important;
  }
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
