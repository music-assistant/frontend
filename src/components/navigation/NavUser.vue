<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { ChevronsUpDown, LogOut, Settings, User } from "lucide-vue-next";
import { useRouter } from "vue-router";

const router = useRouter();
const { isMobile } = useSidebar();

const handleLogout = () => {
  authManager.logout();
};
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage
                v-if="store.currentUser?.avatar_url"
                :src="store.currentUser.avatar_url"
                :alt="store.currentUser?.username"
              />
              <AvatarFallback class="rounded-lg">
                <User :size="16" />
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{
                store.currentUser?.display_name || store.currentUser?.username
              }}</span>
              <span class="truncate text-xs">{{
                store.currentUser?.username
              }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="4"
        >
          <DropdownMenuItem as-child @click="router.push({ name: 'profile' })">
            <v-list-item class="settings-item mb-2 rounded-lg border" link>
              <template #prepend>
                <v-avatar
                  color="primary"
                  variant="tonal"
                  size="32"
                  class="mr-2"
                >
                  <Settings :size="16" />
                </v-avatar>
              </template>
              <v-list-item-title>{{ $t("auth.profile") }}</v-list-item-title>
              <template #append>
                <v-icon icon="mdi-chevron-right" color="grey" size="small" />
              </template>
            </v-list-item>
          </DropdownMenuItem>

          <DropdownMenuItem
            v-if="!store.isIngressSession"
            as-child
            @click="handleLogout"
          >
            <v-list-item class="settings-item mb-2 rounded-lg border" link>
              <template #prepend>
                <v-avatar color="error" variant="tonal" size="32" class="mr-2">
                  <LogOut :size="16" />
                </v-avatar>
              </template>
              <v-list-item-title>{{ $t("auth.logout") }}</v-list-item-title>
              <template #append>
                <v-icon icon="mdi-chevron-right" color="grey" size="small" />
              </template>
            </v-list-item>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style scoped>
.settings-item {
  transition: background-color 0.2s ease-in-out;
  background-color: rgb(var(--v-theme-surface));
  cursor: pointer;
}

.settings-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
