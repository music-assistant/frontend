<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div class="relative flex-1 min-w-[200px] max-w-[400px]">
        <Input v-model="searchQuery" :placeholder="$t('search')" class="w-full">
          <template #prepend>
            <Search :size="16" class="text-muted-foreground" />
          </template>
        </Input>
      </div>
      <Button @click="showCreateDialog = true">
        <Plus :size="16" />
        {{ $t("auth.create_user") }}
      </Button>
    </div>

    <div
      v-if="filteredUsers.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <p class="text-muted-foreground">{{ $t("no_content") }}</p>
    </div>

    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      <Card
        v-for="user in filteredUsers"
        :key="user.user_id"
        class="cursor-pointer hover:bg-accent/50 transition-colors"
        @click="editUser(user)"
      >
        <CardContent class="px-4 py-0">
          <div class="flex items-center gap-4">
            <Avatar class="size-12 shrink-0">
              <AvatarImage v-if="user.avatar_url" :src="user.avatar_url" />
              <AvatarFallback class="bg-muted">
                <UserIcon :size="24" class="text-foreground" />
              </AvatarFallback>
            </Avatar>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-sm truncate">
                    {{ user.display_name || user.username }}
                  </h3>
                  <p class="text-xs text-muted-foreground truncate">
                    {{ user.username }} • {{ $t(`auth.${user.role}_role`) }}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8 shrink-0"
                      @click.stop
                    >
                      <MoreVertical :size="16" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click.stop="editUser(user)">
                      <Pencil :size="16" />
                      {{ $t("auth.edit_user") }}
                    </DropdownMenuItem>
                    <DropdownMenuItem @click.stop="manageTokens(user)">
                      <Key :size="16" />
                      {{ $t("auth.manage_tokens") }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="!isCurrentUser(user)"
                      @click.stop="
                        user.enabled
                          ? confirmDisableUser(user)
                          : enableUser(user)
                      "
                    >
                      <component
                        :is="user.enabled ? MonitorOff : Monitor"
                        :size="16"
                      />
                      {{
                        user.enabled
                          ? $t("auth.disable_user")
                          : $t("auth.enable_user")
                      }}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator v-if="!isCurrentUser(user)" />
                    <DropdownMenuItem
                      v-if="!isCurrentUser(user)"
                      class="text-destructive focus:text-destructive"
                      @click.stop="confirmDeleteUser(user)"
                    >
                      <Trash2 :size="16" />
                      {{ $t("auth.delete_user") }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Badge v-if="!user.enabled" variant="destructive" class="mt-2">
                {{ $t("auth.disabled") }}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <CreateUserDialog v-model="showCreateDialog" @created="loadUsers" />
    <EditUserDialog
      v-model="showEditDialog"
      :user="userToModify"
      @updated="loadUsers"
    />
    <DisableUserDialog
      v-model="showDisableDialog"
      :user="userToModify"
      @disabled="loadUsers"
    />
    <DeleteUserDialog
      v-model="showDeleteDialog"
      :user="userToModify"
      @deleted="loadUsers"
    />
    <ManageTokensDialog
      v-model="showTokensDialog"
      :user="userToModify"
      :tokens="userTokens"
      @revoke="confirmRevokeToken"
      @token-created="handleTokenCreated"
    />
    <RevokeTokenDialog
      v-model="showRevokeTokenDialog"
      :token="tokenToRevoke"
      @revoked="handleTokenRevoked"
    />
  </div>
</template>

<script setup lang="ts">
import {
  Key,
  Monitor,
  MonitorOff,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import CreateUserDialog from "@/components/users/CreateUserDialog.vue";
import DeleteUserDialog from "@/components/users/DeleteUserDialog.vue";
import DisableUserDialog from "@/components/users/DisableUserDialog.vue";
import EditUserDialog from "@/components/users/EditUserDialog.vue";
import ManageTokensDialog from "@/components/users/ManageTokensDialog.vue";
import RevokeTokenDialog from "@/components/users/RevokeTokenDialog.vue";
import { api } from "@/plugins/api";
import type { AuthToken, User } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

const { t } = useI18n();

const users = ref<User[]>([]);
const searchQuery = ref("");
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const showDisableDialog = ref(false);
const showDeleteDialog = ref(false);
const showTokensDialog = ref(false);
const showRevokeTokenDialog = ref(false);
const userToModify = ref<User | null>(null);
const userTokens = ref<AuthToken[]>([]);
const tokenToRevoke = ref<AuthToken | null>(null);

const filteredUsers = computed(() => {
  if (!searchQuery.value) {
    return users.value;
  }
  const query = searchQuery.value.toLowerCase();
  return users.value.filter((user) => {
    const displayName = (user.display_name || user.username).toLowerCase();
    const username = user.username.toLowerCase();
    return displayName.includes(query) || username.includes(query);
  });
});

const isCurrentUser = (user: User | null): boolean => {
  if (!user || !store.currentUser) return false;
  return user.user_id === store.currentUser.user_id;
};

const loadUsers = async () => {
  try {
    users.value = await api.getAllUsers();
  } catch (error) {
    toast.error(t("auth.users_load_failed"));
  }
};

const editUser = (user: User) => {
  userToModify.value = user;
  showEditDialog.value = true;
};

const confirmDisableUser = (user: User) => {
  userToModify.value = user;
  showDisableDialog.value = true;
};

const confirmDeleteUser = (user: User) => {
  userToModify.value = user;
  showDeleteDialog.value = true;
};

const manageTokens = async (user: User) => {
  userToModify.value = user;
  await loadUserTokens(user.user_id);
  showTokensDialog.value = true;
};

const loadUserTokens = async (userId: string) => {
  try {
    userTokens.value = await api.getUserTokens(userId);
  } catch (error) {
    toast.error(t("auth.tokens_load_failed"));
  }
};

const handleTokenCreated = async () => {
  if (userToModify.value) {
    await loadUserTokens(userToModify.value.user_id);
  }
};

const confirmRevokeToken = (token: AuthToken) => {
  tokenToRevoke.value = token;
  showRevokeTokenDialog.value = true;
};

const handleTokenRevoked = async () => {
  if (userToModify.value) {
    await loadUserTokens(userToModify.value.user_id);
  }
  tokenToRevoke.value = null;
};

const enableUser = async (user: User) => {
  try {
    const success = await api.enableUser(user.user_id);
    if (success) {
      await loadUsers();
      toast.success(t("auth.user_enabled"));
    } else {
      toast.error(t("auth.user_enable_failed"));
    }
  } catch (error) {
    toast.error(t("auth.user_enable_failed"));
  }
};

onMounted(() => {
  loadUsers();
});
</script>
