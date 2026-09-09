<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authManager } from "@/plugins/auth";
import { api } from "@/plugins/api";
import { copyToClipboard } from "@/helpers/utils";
import { useAccountSwitcher } from "@/composables/useAccountSwitcher";
import { useScrobblingStatus } from "@/composables/useScrobblingStatus";
import { store } from "@/plugins/store";
import { Activity, Copy, LogOut, Pencil, Server, UserRound } from "@lucide/vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { useRouter } from "vue-router";
import ProfileAvatarEditor from "@/components/profile/ProfileAvatarEditor.vue";
import {
  accountAccentClass as getAccountAccentClass,
  accountAccentBackgroundClass as getAccountAccentBackgroundClass,
  accountAccentButtonGlowClass as getAccountAccentButtonGlowClass,
  getConnectionStatusKey,
} from "./accountMenu";

const { t } = useI18n();
const { status: scrobblingStatus, providerSummary } = useScrobblingStatus();

const router = useRouter();
const { isMobile, setOpenMobile } = useSidebar();
const {
  accountInitial,
  accountName,
  availableAccounts,
  loadAccounts,
  openAccountSwitcher: requestAccountSwitcher,
  selectAccount,
} = useAccountSwitcher();
const accountMenuOpen = ref(false);
const savingAvatar = ref(false);

const displayName =
  store.currentUser?.display_name || store.currentUser?.username || "";
const username = store.currentUser?.username || "";
const initial = displayName ? displayName[0].toUpperCase() : "U";
const serverName = computed(
  () => api.serverInfo.value?.name || store.serverInfo?.name || "",
);
const currentAccountAccentClass = computed(() =>
  store.currentUser ? getAccountAccentClass(username) : "",
);
const currentAccountAccentBackgroundClass = computed(() =>
  store.currentUser ? getAccountAccentBackgroundClass(username) : "",
);
const connectionStatusKey = computed(() =>
  getConnectionStatusKey(api.transportState.value),
);
const scrobblingProviderNames = computed(() =>
  scrobblingStatus.value.providerNames.join(", "),
);
const scrobblingLabel = computed(() =>
  t("auth.scrobbling_ready", { providers: scrobblingProviderNames.value }),
);

const handleProfile = () => {
  setOpenMobile(false);
  router.push({ name: "profile" });
};

const handleLogout = () => {
  setOpenMobile(false);
  authManager.logout();
};

const handleAvatarUpdate = async (avatarUrl: string) => {
  if (!store.currentUser || savingAvatar.value) return;
  savingAvatar.value = true;
  try {
    const updatedUser = await api.updateUser(store.currentUser.user_id, {
      avatarUrl,
    });
    if (updatedUser) {
      store.currentUser = updatedUser;
      toast.success(t("auth.profile_updated"));
    }
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : t("error_generic"));
  } finally {
    savingAvatar.value = false;
  }
};

const copyUsername = async () => {
  if (!username) return;
  const copied = await copyToClipboard(username);
  if (copied) {
    toast.success(t("auth.username_copied"));
  } else {
    toast.error(t("auth.username_copy_failed"));
  }
};

const openAccountSwitcher = () => {
  accountMenuOpen.value = false;
  if (isMobile.value) {
    setOpenMobile(false);
  }
  requestAccountSwitcher();
};

const accountAccentClass = (account: { username: string }) =>
  getAccountAccentClass(account.username);
</script>

<template>
  <SidebarMenu class="w-full">
    <SidebarMenuItem class="w-full">
      <DropdownMenu
        v-model:open="accountMenuOpen"
        @update:open="(open) => open && loadAccounts()"
      >
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            :ripple="true"
            :class="[
              'w-full overflow-visible hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-active data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-[34px]! group-data-[collapsible=icon]:w-[34px]! group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-self-center',
            ]"
          >
            <span
              class="relative mr-1 size-[34px] shrink-0 group-data-[collapsible=icon]:mr-0"
            >
              <span
                v-if="scrobblingStatus.configured"
                class="scrobbling-avatar-glow-base pointer-events-none absolute inset-0 rounded-full"
                :class="getAccountAccentButtonGlowClass(username)"
                aria-hidden="true"
              ></span>
              <span
                v-if="scrobblingStatus.configured && !accountMenuOpen"
                class="scrobbling-avatar-glow pointer-events-none absolute inset-0 rounded-full"
                :class="[
                  getAccountAccentButtonGlowClass(username),
                  'scrobbling-avatar-glow--active',
                ]"
                aria-hidden="true"
              ></span>
              <Avatar
                class="relative z-10 size-full rounded-full"
                :class="currentAccountAccentClass"
              >
                <AvatarImage
                  v-if="store.currentUser?.avatar_url"
                  :src="store.currentUser.avatar_url"
                  :alt="displayName"
                />
                <AvatarFallback
                  class="rounded-full bg-primary text-primary-foreground"
                  :class="currentAccountAccentClass"
                >
                  {{ initial }}
                </AvatarFallback>
              </Avatar>
            </span>
            <span
              class="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
            >
              <span class="truncate font-medium">{{ displayName }}</span>
              <span
                class="text-muted-foreground truncate text-xs leading-none group-data-[collapsible=icon]:hidden"
              >
                <span v-if="username">{{ username }}</span>
              </span>
            </span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="z-[100001] w-[16.2rem] min-w-0 rounded-lg"
          side="top"
          :side-offset="isMobile ? 4 : 8"
          align="start"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="relative">
              <div
                class="h-20 rounded-t-md"
                :class="currentAccountAccentClass"
              ></div>
              <div class="relative px-3 pb-2">
                <div class="account-profile-avatar absolute -top-8 left-3">
                  <span
                    class="account-profile-avatar-backdrop pointer-events-none absolute -inset-1 rounded-full bg-popover"
                    aria-hidden="true"
                  ></span>
                  <span
                    v-if="scrobblingStatus.configured && accountMenuOpen"
                    class="scrobbling-avatar-glow scrobbling-avatar-glow--active pointer-events-none absolute -inset-1 rounded-full"
                    :class="currentAccountAccentBackgroundClass"
                    aria-hidden="true"
                  ></span>
                  <div class="relative z-10">
                    <ProfileAvatarEditor
                      :model-value="store.currentUser?.avatar_url"
                      avatar-class="size-20"
                      :disabled="store.isIngressSession || savingAvatar"
                      @update:model-value="handleAvatarUpdate"
                    />
                  </div>
                </div>
                <div
                  v-if="scrobblingStatus.configured"
                  class="absolute top-2 right-3 left-26 flex min-w-0 items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5"
                  role="status"
                  :aria-label="scrobblingLabel"
                  :title="scrobblingLabel"
                >
                  <Activity
                    class="size-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div class="grid min-w-0 gap-0.5 text-left leading-tight">
                    <span class="text-[10px] font-medium text-foreground">{{
                      $t("auth.scrobbling")
                    }}</span>
                    <span class="truncate text-[10px] text-muted-foreground">{{
                      providerSummary
                    }}</span>
                  </div>
                </div>
                <div class="grid min-w-0 pt-17 text-left leading-tight">
                  <span
                    class="text-foreground truncate text-lg leading-none font-semibold"
                    >{{ displayName }}</span
                  >
                  <div class="flex min-w-0 flex-col items-start gap-2">
                    <button
                      v-if="username"
                      type="button"
                      class="text-foreground group flex min-w-0 items-center gap-1 self-start text-sm hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      :aria-label="$t('auth.copy_username')"
                      :title="$t('auth.copy_username')"
                      @click.stop="copyUsername"
                    >
                      <span class="truncate">{{ username }}</span>
                      <Copy
                        class="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                    <Badge
                      variant="outline"
                      class="h-5 max-w-[50%] gap-1 rounded-full px-1.5 text-[10px] font-normal text-white"
                      :class="currentAccountAccentClass"
                      role="status"
                      :aria-label="$t('auth.connection_' + connectionStatusKey)"
                    >
                      <Server
                        class="size-3 shrink-0 text-white"
                        aria-hidden="true"
                      />
                      <span v-if="serverName" class="truncate">
                        {{ serverName }}
                      </span>
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="handleProfile">
            <Pencil class="size-4" />
            {{ $t("auth.edit_profile") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              class="cursor-pointer"
              @click.prevent.stop="openAccountSwitcher"
            >
              <UserRound class="size-4" />
              {{ $t("auth.switch_accounts") }}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="z-[100002] min-w-52">
              <DropdownMenuItem
                v-for="item in availableAccounts"
                :key="item.account?.token || item.user?.user_id"
                @click="selectAccount(item)"
              >
                <Avatar
                  class="size-6 border"
                  :class="accountAccentClass(item.user || item.account!)"
                >
                  <AvatarImage
                    v-if="item.user?.avatar_url || item.account?.avatarUrl"
                    :src="
                      item.user?.avatar_url || item.account?.avatarUrl || ''
                    "
                    :alt="accountName(item.user || item.account!)"
                  />
                  <AvatarFallback
                    class="text-primary-foreground text-xs"
                    :class="accountAccentClass(item.user || item.account!)"
                    >{{
                      accountInitial(item.user || item.account!)
                    }}</AvatarFallback
                  >
                </Avatar>
                <span class="truncate">{{
                  accountName(item.user || item.account!)
                }}</span>
                <span
                  v-if="item.account?.token === authManager.getToken()"
                  class="ml-auto text-xs text-muted-foreground"
                  >{{ $t("auth.current") }}</span
                >
                <span
                  v-else-if="!item.account"
                  class="ml-auto text-xs text-muted-foreground"
                  >{{ $t("auth.login") }}</span
                >
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
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
.scrobbling-avatar-glow {
  z-index: 1;
}

.scrobbling-avatar-glow--active {
  animation: scrobbling-avatar-pulse 1.8s ease-out infinite;
}

.scrobbling-avatar-glow-base {
  opacity: 0.3;
  z-index: 1;
}

@keyframes scrobbling-avatar-pulse {
  0%,
  15% {
    opacity: 0.65;
    transform: scale(1);
  }

  70%,
  100% {
    opacity: 0;
    transform: scale(1.55);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scrobbling-avatar-glow--active {
    animation: none;
  }
}
</style>
