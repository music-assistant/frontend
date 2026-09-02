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
  <div :class="['flex w-full min-w-0 flex-col overflow-hidden', props.class]">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          data-sidebar="trigger"
          data-slot="sidebar-trigger"
          variant="ghost"
          size="icon"
          :class="['flex-shrink-0', isCollapsed ? 'mx-auto' : 'ml-auto']"
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
    <div class="navuser-trigger w-full min-w-0">
      <NavUser />
    </div>
  </div>
</template>

<style scoped>
.navuser-trigger :deep([data-sidebar="menu-button"]) {
  margin-left: 0 !important;
  padding-right: 0;
}

.navuser-trigger :deep(ul[data-sidebar="menu"]) {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
</style>
