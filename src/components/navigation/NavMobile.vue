<template>
  <!-- HA BUTTON COMMENTED OUT -->
  <!-- <Button
    v-if="store.isIngressSession && isMobile"
    size="sm"
    variant="outline"
    class="w-full justify-between"
    title="HA Menu"
    @click.stop="handleHAMenuToggle"
  >
    <span class="flex items-center gap-2">
      <img
        src="@/assets/home-assistant-logo.svg"
        alt="Home Assistant"
        class="h-4 w-4 shrink-0"
      />
      <span>HA Menu</span>
    </span>
    <ArrowLeftToLine class="ha-menu-arrow size-4 shrink-0" />
  </Button> -->
  <NavUser />
</template>

<script setup lang="ts">
// import { Button } from "@/components/ui/button";
// import { useSidebar } from "@/components/ui/sidebar";
// import { toggleHAMenu } from "@/plugins/homeassistant";
// import { store } from "@/plugins/store";
// import { ArrowLeftToLine } from "lucide-vue-next";
import NavUser from "./NavUser.vue";

// const { isMobile, setOpenMobile } = useSidebar();

// const handleHAMenuToggle = () => {
//   // Close MA sidebar on mobile when opening HA sidebar
//   if (isMobile.value) {
//     setOpenMobile(false);
//   }
//   toggleHAMenu();
// };
</script>
