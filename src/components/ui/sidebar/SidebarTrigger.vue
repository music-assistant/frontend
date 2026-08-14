<script setup lang="ts">
import NavUser from "@/components/navigation/NavUser.vue";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PanelLeft } from "@lucide/vue";
import { computed, type HTMLAttributes } from "vue";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const { toggleSidebar, state } = useSidebar();

const isCollapsed = computed(() => state.value === "collapsed");
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
        'flex w-full min-w-0 items-center gap-1 px-0',
        isCollapsed ? 'flex-col' : 'flex-row',
      ]"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            data-sidebar="trigger"
            data-slot="sidebar-trigger"
            variant="ghost"
            size="icon"
            :class="['flex-shrink-0', !isCollapsed && 'ml-auto']"
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

.trigger-container.flex-col {
  flex-direction: column;
  justify-content: center;
}

.trigger-container.flex-row {
  flex-direction: row;
}
</style>
