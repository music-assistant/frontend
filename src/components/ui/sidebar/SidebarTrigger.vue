<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { haState, toggleHAMenuVisibility } from "@/plugins/homeassistant";
import { store } from "@/plugins/store";
import { PanelLeft } from "lucide-vue-next";
import { computed, type HTMLAttributes } from "vue";
import { useSidebar } from "./utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const { toggleSidebar, state, isMobile, setOpenMobile } = useSidebar();

const isCollapsed = computed(() => state.value === "collapsed");

const haButtonTooltip = computed(() => {
  return haState.kioskModeEnabled
    ? "Show Home Assistant Menu"
    : "Hide Home Assistant Menu";
});

const handleHAMenuToggle = () => {
  // Close MA sidebar on mobile when opening HA sidebar
  if (isMobile.value && haState.kioskModeEnabled) {
    setOpenMobile(false);
  }
  toggleHAMenuVisibility();
};
</script>

<template>
  <div
    :class="[
      'trigger-container',
      isCollapsed ? 'flex-col -mr-2' : 'flex-row',
      props.class,
    ]"
  >
    <!-- HA Menu Toggle Button -->
    <Tooltip v-if="store.isIngressSession">
      <TooltipTrigger as-child>
        <Button
          v-if="store.isIngressSession"
          variant="ghost"
          size="icon"
          :class="[, isCollapsed && 'order-first']"
          @click="handleHAMenuToggle"
        >
          <img
            src="@/assets/home-assistant-logo.svg"
            alt="Home Assistant"
            class="ha-logo-icon"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        :hidden="!isCollapsed || isMobile"
      >
        {{ haButtonTooltip }}
      </TooltipContent>
    </Tooltip>

    <!-- Sidebar Toggle Button -->
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
      <TooltipContent
        side="right"
        align="center"
        :hidden="!isCollapsed || isMobile"
      >
        {{ isCollapsed ? "Expand Sidebar" : "Collapse Sidebar" }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>

<style scoped>
.trigger-container {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: 100%;
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
