<script setup lang="ts">
import { useSidebar } from "@/components/ui/sidebar";
import { Menu } from "lucide-vue-next";

const { toggleSidebar } = useSidebar();
</script>

<template>
  <v-btn
    class="mobile-sidebar-trigger"
    icon
    variant="text"
    aria-label="Open navigation"
    @click="toggleSidebar"
  >
    <Menu class="w-6 h-6" />
  </v-btn>
</template>

<style scoped>
.mobile-sidebar-trigger {
  min-width: 0;
  padding: 0;
  margin-right: 4px;
}
</style>
