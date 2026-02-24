<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { LogOut, MoreVertical, Pencil, Settings } from "lucide-vue-next";
import { useRouter } from "vue-router";

const router = useRouter();
const { isMobile, setOpenMobile } = useSidebar();

const displayName =
  store.currentUser?.display_name || store.currentUser?.username || "";
const username = store.currentUser?.username || "";
const initial = displayName ? displayName[0].toUpperCase() : "U";

const handleProfile = () => {
  setOpenMobile(false);
  router.push({ name: "profile" });
};

const handleEditHomescreen = () => {
  setOpenMobile(false);
  router.push("/");
  eventbus.emit("homescreen-edit-toggle");
};

const handleLogout = () => {
  setOpenMobile(false);
  authManager.logout();
};
</script>

<template>
  <SidebarMenu class="w-full">
    <SidebarMenuItem class="w-full">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="w-full data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 shrink-0 rounded-lg">
              <AvatarImage
                v-if="store.currentUser?.avatar_url"
                :src="store.currentUser.avatar_url"
                :alt="displayName"
              />
              <AvatarFallback
                class="rounded-lg bg-primary text-primary-foreground"
              >
                {{ initial }}
              </AvatarFallback>
            </Avatar>
            <div class="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ displayName }}</span>
              <span class="text-muted-foreground truncate text-xs">
                {{ username }}
              </span>
            </div>
            <MoreVertical
              style="width: 1rem !important"
              class="ml-auto shrink-0 opacity-70"
            />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="z-[100001] w-(--reka-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          :side-offset="isMobile ? 4 : 15"
          align="end"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage
                  v-if="store.currentUser?.avatar_url"
                  :src="store.currentUser.avatar_url"
                  :alt="displayName"
                />
                <AvatarFallback
                  class="rounded-lg bg-primary text-primary-foreground"
                >
                  {{ initial }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">{{ displayName }}</span>
                <span class="text-muted-foreground truncate text-xs">
                  {{ username }}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="handleProfile">
            <Settings class="size-4" />
            {{ $t("auth.profile") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="handleEditHomescreen">
            <Pencil class="size-4" />
            {{ $t("homescreen_edit_enable") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="!store.isIngressSession"
            @click="handleLogout"
          >
            <LogOut class="size-4" />
            {{ $t("auth.logout") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style scoped>
.ha-menu-arrow {
  color: rgb(var(--v-theme-primary, 3, 169, 244)) !important;
}
</style>
