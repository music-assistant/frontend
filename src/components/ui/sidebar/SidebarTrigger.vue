<script setup lang="ts">
import NavUser from "@/components/navigation/NavUser.vue";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toggleHAMenu } from "@/plugins/homeassistant";
import { store } from "@/plugins/store";
import { ArrowRightToLine, PanelLeft } from "lucide-vue-next";
import { computed, type HTMLAttributes } from "vue";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const { toggleSidebar, state } = useSidebar();

const isCollapsed = computed(() => state.value === "collapsed");

const handleToggleHaSidebar = () => {
  toggleHAMenu();
};
</script>

<template>
  <div
    :class="[
      'trigger-container',
      'flex w-full min-w-0 flex-col overflow-hidden',
      isCollapsed && '-mr-2 trigger-container--collapsed',
      props.class,
    ]"
  >
    <div
      :class="[
        'flex min-w-0 items-center gap-1 px-0',
        isCollapsed ? 'flex-col' : 'flex-row ml-auto',
      ]"
    >
      <Tooltip v-if="store.isIngressSession">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            :size="isCollapsed ? 'icon' : 'default'"
            :class="[isCollapsed ? 'order-first' : 'flex-shrink-0']"
            @click="handleToggleHaSidebar"
          >
            <img
              src="@/assets/home-assistant-logo.svg"
              alt="Home Assistant"
              class="h-4 w-4 shrink-0"
            />
            <ArrowRightToLine
              v-if="!isCollapsed"
              class="ha-menu-arrow ml-auto size-4 shrink-0"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center" :hidden="!isCollapsed">
          Toggle Home Assistant Menu
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            variant="ghost"
            size="icon"
            class="flex-shrink-0"
            @click="toggleSidebar"
          >
            <PanelLeft />
            <span class="sr-only">Toggle Sidebar</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center" :hidden="!isCollapsed">
          {{ isCollapsed ? "Expand Sidebar" : "Collapse Sidebar" }}
        </TooltipContent>
      </Tooltip>
    </div>
    <div class="navuser-trigger w-full min-w-0">
      <NavUser />
    </div>
  </div>
</template>

<style scoped>
.trigger-container {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
}

.navuser-trigger :deep([data-sidebar="menu-button"]) {
  margin-left: 0 !important;
  padding-right: 0;
}

.trigger-container:not(.trigger-container--collapsed)
  .navuser-trigger
  :deep(ul[data-sidebar="menu"]) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.trigger-container--collapsed .navuser-trigger :deep(ul[data-sidebar="menu"]) {
  padding-left: 6px !important;
  padding-right: 6px !important;
}

.trigger-container--collapsed
  .navuser-trigger
  :deep([data-sidebar="menu-button"]) {
  width: 100% !important;
}

.trigger-container--collapsed
  .navuser-trigger
  :deep([data-sidebar="menu-button"] .rounded-lg) {
  width: 2rem !important;
  height: 2rem !important;
}

.ha-menu-arrow {
  color: rgb(var(--v-theme-primary, 3, 169, 244)) !important;
}

.trigger-container.flex-col {
  flex-direction: column;
  justify-content: center;
}

.trigger-container.flex-row {
  flex-direction: row;
}

.ha-logo-icon {
  width: 16px;
  height: 16px;
  display: block;
  margin: auto;
}
</style>
