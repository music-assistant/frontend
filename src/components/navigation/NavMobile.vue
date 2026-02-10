<template>
  <Button
    v-if="store.isIngressSession && isMobile"
    size="sm"
    variant="outline"
    class="w-full justify-between"
    :title="haButtonTooltip"
    @click.stop="handleHAMenuToggle"
  >
    <span class="flex items-center gap-2">
      <img
        src="@/assets/home-assistant-logo.svg"
        alt="Home Assistant"
        class="h-4 w-4 shrink-0"
      />
      <span>{{ haButtonTooltip }}</span>
    </span>
    <component
      :is="haState.kioskModeEnabled ? ArrowLeftToLine : ArrowRightFromLine"
      class="ha-menu-arrow size-4 shrink-0"
    />
  </Button>
  <NavUser />
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { haState, toggleHAMenuVisibility } from "@/plugins/homeassistant";
import { store } from "@/plugins/store";
import { ArrowLeftToLine, ArrowRightFromLine } from "lucide-vue-next";
import { computed } from "vue";
import NavUser from "./NavUser.vue";

const { isMobile, setOpenMobile } = useSidebar();

const haButtonTooltip = computed(() => {
  return haState.kioskModeEnabled ? "Show HA menu" : "Hide HA menu";
});

const handleHAMenuToggle = () => {
  // Close MA sidebar on mobile when opening HA sidebar
  if (isMobile.value && haState.kioskModeEnabled) {
    setOpenMobile(false);
  }
  toggleHAMenuVisibility();
};
</script>
