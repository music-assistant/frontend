<script setup lang="ts">
import NavMain from "@/components/navigation/NavMain.vue";
import NavUser from "@/components/navigation/NavUser.vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { getMenuItems } from "./utils/getMenuItems";

const router = useRouter();
const { t } = useI18n();

const menuItems = getMenuItems();

const navItems = computed(() => {
  return menuItems
    .filter((item) => !item.hidden)
    .map((item) => ({
      title: t(item.label),
      url: item.path,
      icon: item.icon,
    }));
});
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem
          class="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center"
        >
          <div
            class="flex items-center gap-2 cursor-pointer group-data-[collapsible=icon]:hidden"
            @click="router.push('/')"
          >
            <img
              src="@/assets/icon.svg"
              alt="Music Assistant"
              class="size-8 shrink-0"
            />
            <span class="font-bold text-lg truncate">Music Assistant</span>
          </div>
          <SidebarTrigger />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navItems" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser />
    </SidebarFooter>
  </Sidebar>
</template>

<style scoped></style>
