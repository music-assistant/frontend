<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authManager } from "@/plugins/auth";
import { api } from "@/plugins/api";
import { copyToClipboard } from "@/helpers/utils";
import { useScrobblingStatus } from "@/composables/useScrobblingStatus";
import type { SavedAccount } from "@/plugins/auth";
import type { User } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { Activity, Copy, LogOut, Pencil, Server, UserRound } from "@lucide/vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { useRouter } from "vue-router";
import ProfileAvatarEditor from "@/components/profile/ProfileAvatarEditor.vue";
import { Input } from "@/components/ui/input";
import {
  accountAccentClass as getAccountAccentClass,
  accountAccentBackgroundClass as getAccountAccentBackgroundClass,
  accountAccentButtonClass as getAccountAccentButtonClass,
  accountSwitcherAccentClass,
  getConnectionStatusKey,
} from "./accountMenu";

const { t } = useI18n();
const { status: scrobblingStatus, providerSummary } = useScrobblingStatus();

const router = useRouter();
const { isMobile, setOpenMobile } = useSidebar();
const accountMenuOpen = ref(false);
const switchAccountsOpen = ref(false);
const savedAccounts = computed(() => authManager.getSavedAccounts());
const serverUsers = ref<User[]>([]);
const savingAvatar = ref(false);
const loginUser = ref<User | null>(null);
const loginPassword = ref("");
const loginLoading = ref(false);
const loginError = ref("");
const loginDialogOpen = ref(false);
interface AccountOption {
  user?: User;
  account?: SavedAccount;
}

const availableAccounts = computed<AccountOption[]>(() => {
  if (!serverUsers.value.length) {
    return savedAccounts.value.map((account) => ({
      user: undefined,
      account,
    }));
  }

  return serverUsers.value.map((user) => ({
    user,
    account: savedAccounts.value.find(
      (account) => account.username === user.username,
    ),
  }));
});

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
const currentAccountButtonAccentClass = computed(() =>
  store.currentUser ? getAccountAccentButtonClass(username) : "",
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
  switchAccountsOpen.value = true;
  loadAccounts();
};

const loadAccounts = async () => {
  if (!authManager.isAdmin()) {
    serverUsers.value = [];
    return;
  }
  try {
    serverUsers.value = await api.getAllUsers();
  } catch {
    // Non-admin users cannot list all accounts; remembered sessions still work.
  }
};

const addAccount = () => {
  authManager.logout();
};

const switchAccount = (account: SavedAccount | undefined) => {
  if (!account) return;
  switchAccountsOpen.value = false;
  authManager.switchAccount(account);
};

const selectAccount = (item: { user?: User; account?: SavedAccount }) => {
  if (item.account) {
    switchAccount(item.account);
    return;
  }
  if (!item.user) return;
  loginUser.value = item.user;
  loginPassword.value = "";
  loginError.value = "";
  loginDialogOpen.value = true;
};

const signInToAccount = async () => {
  if (!loginUser.value || !loginPassword.value || loginLoading.value) return;
  loginLoading.value = true;
  loginError.value = "";
  try {
    const result = await api.loginWithCredentials(
      loginUser.value.username,
      loginPassword.value,
    );
    authManager.setToken(result.token);
    authManager.setCurrentUser(result.user);
    loginDialogOpen.value = false;
    switchAccountsOpen.value = false;
    window.location.reload();
  } catch (error: unknown) {
    loginError.value =
      error instanceof Error ? error.message : t("auth.login_failed");
  } finally {
    loginLoading.value = false;
  }
};

const accountName = (account: SavedAccount | User) =>
  ("display_name" in account ? account.display_name : account.displayName) ||
  account.username;

const accountInitial = (account: SavedAccount | User) =>
  accountName(account).charAt(0).toUpperCase() || "U";

const accountAccentClass = (account: SavedAccount | User) =>
  getAccountAccentClass(account.username);

const accountSwitcherClass = (account: SavedAccount | User) =>
  accountSwitcherAccentClass(account.username);
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
            :class="[
              'w-full hover:bg-transparent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-[3px]!',
              currentAccountButtonAccentClass,
            ]"
          >
            <div
              class="relative mr-1 size-[34px] shrink-0 group-data-[collapsible=icon]:mr-0"
            >
              <span
                v-if="scrobblingStatus.configured"
                class="scrobbling-avatar-glow-base pointer-events-none absolute -inset-1 rounded-full"
                :class="currentAccountAccentBackgroundClass"
                aria-hidden="true"
              ></span>
              <span
                v-if="scrobblingStatus.configured"
                class="scrobbling-avatar-glow pointer-events-none absolute -inset-1 rounded-full"
                :class="[
                  currentAccountAccentBackgroundClass,
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
            </div>
            <div class="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ displayName }}</span>
              <span class="text-muted-foreground truncate text-xs leading-none">
                <span v-if="username">{{ username }}</span>
              </span>
            </div>
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
                  <ProfileAvatarEditor
                    :model-value="store.currentUser?.avatar_url"
                    :avatar-class="`size-20 border-4 ${currentAccountAccentClass}`"
                    :disabled="store.isIngressSession || savingAvatar"
                    @update:model-value="handleAvatarUpdate"
                  />
                </div>
                <div class="grid min-w-0 pt-17 text-left leading-tight">
                  <span
                    class="truncate text-lg font-semibold text-white leading-none"
                    >{{ displayName }}</span
                  >
                  <div class="flex min-w-0 flex-col items-start gap-2">
                    <button
                      v-if="username"
                      type="button"
                      class="group flex min-w-0 items-center gap-1 self-start text-sm text-white hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div
            v-if="scrobblingStatus.configured"
            class="flex items-center gap-2 px-2 py-1.5 text-xs"
            role="status"
            :aria-label="scrobblingLabel"
          >
            <Activity
              class="size-4 shrink-0 text-emerald-500"
              aria-hidden="true"
            />
            <span class="min-w-0 truncate">
              {{ $t("auth.scrobbling") }} · {{ providerSummary }}
            </span>
            <span class="sr-only">{{ scrobblingLabel }}</span>
          </div>
          <DropdownMenuSeparator v-if="scrobblingStatus.configured" />
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

  <Dialog v-model:open="switchAccountsOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t("auth.switch_account") }}</DialogTitle>
        <DialogDescription>{{
          $t("auth.switch_account_description")
        }}</DialogDescription>
      </DialogHeader>
      <div class="grid gap-2">
        <button
          v-for="item in availableAccounts"
          :key="item.account?.token || item.user?.user_id"
          type="button"
          class="flex items-center gap-3 rounded-lg border border-l-4 p-3 text-left transition-colors hover:bg-accent"
          :class="accountSwitcherClass(item.user || item.account!)"
          @click="selectAccount(item)"
        >
          <Avatar
            class="size-10 border"
            :class="accountAccentClass(item.user || item.account!)"
          >
            <AvatarImage
              v-if="item.user?.avatar_url || item.account?.avatarUrl"
              :src="item.user?.avatar_url || item.account?.avatarUrl || ''"
              :alt="accountName(item.user || item.account!)"
            />
            <AvatarFallback
              class="text-primary-foreground"
              :class="accountAccentClass(item.user || item.account!)"
              >{{ accountInitial(item.user || item.account!) }}</AvatarFallback
            >
          </Avatar>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{
              accountName(item.user || item.account!)
            }}</span>
            <span class="block truncate text-xs text-muted-foreground">
              @{{ item.user?.username || item.account?.username }}
            </span>
          </span>
          <span v-if="!item.account" class="text-xs text-muted-foreground">{{
            $t("auth.login")
          }}</span>
          <span
            v-if="item.account?.token === authManager.getToken()"
            class="text-xs text-muted-foreground"
            >{{ $t("auth.current") }}</span
          >
        </button>
        <p
          v-if="savedAccounts.length < 2"
          class="rounded-lg bg-muted p-3 text-sm text-muted-foreground"
        >
          {{ $t("auth.add_account_hint") }}
        </p>
        <button
          type="button"
          class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
          @click="addAccount"
        >
          {{ $t("auth.add_account") }}
        </button>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model:open="loginDialogOpen">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ $t("auth.login") }}</DialogTitle>
        <DialogDescription>{{ loginUser?.username }}</DialogDescription>
      </DialogHeader>
      <form class="grid gap-4" @submit.prevent="signInToAccount">
        <div class="grid gap-2">
          <label for="switch-account-password" class="text-sm font-medium">
            {{ $t("auth.password") }}
          </label>
          <Input
            id="switch-account-password"
            v-model="loginPassword"
            type="password"
            autocomplete="current-password"
            autofocus
          />
          <p v-if="loginError" class="text-sm text-destructive">
            {{ loginError }}
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="loginDialogOpen = false"
          >
            {{ $t("cancel") }}
          </Button>
          <Button type="submit" :loading="loginLoading">
            {{ $t("auth.login") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.account-profile-avatar :deep([data-slot="avatar"]) {
  border-color: var(--sidebar) !important;
}

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
