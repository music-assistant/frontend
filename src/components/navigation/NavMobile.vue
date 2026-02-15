<template>
  <Button
    v-if="store.isIngressSession"
    variant="ghost"
    class="flex-shrink-0 ml-auto"
    @click="handleHAMenuToggle"
  >
    <img
      src="@/assets/home-assistant-logo.svg"
      alt="Home Assistant"
      class="h-4 w-4 shrink-0"
    />
    <ArrowRightToLine class="ha-menu-arrow ml-auto size-4 shrink-0" />
  </Button>
  <NavUser />
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { toggleHAMenu } from "@/plugins/homeassistant";
import { store } from "@/plugins/store";
import { ArrowRightToLine } from "lucide-vue-next";
import { useSidebar } from "../ui/sidebar";
import NavUser from "./NavUser.vue";

const { isMobile, setOpenMobile } = useSidebar();

const handleHAMenuToggle = () => {
  if (isMobile.value) {
    setOpenMobile(false);
  }
  toggleHAMenu();
};
</script>

<style scoped>
.ha-menu-arrow {
  color: rgb(var(--v-theme-primary, 3, 169, 244)) !important;
}
</style>
