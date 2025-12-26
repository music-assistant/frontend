<template>
  <v-container class="pa-4 mx-auto" style="max-width: 600px">
    <div class="d-flex align-center justify-space-between mb-4">
        <v-text-field
          v-model="searchQuery"
          :placeholder="$t('search')"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="comfortable"
          hide-details
          clearable
          class="search-field mr-4"
        />
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          {{ $t("auth.create_user") }}
        </v-btn>
    </div>

    <div
      v-if="filteredUsers.length === 0"
      class="d-flex flex-column align-center justify-center py-6 border rounded-lg text-center"
    >
      <p class="text-medium-emphasis">{{ $t("no_content") }}</p>
    </div>

    <v-list v-else lines="two" class="bg-transparent pa-0">
      <v-list-item
        v-for="user in filteredUsers"
        :key="user.user_id"
        class="settings-item py-3 mb-3 rounded-lg border"
        elevation="0"
        @click="editUser(user)"
      >
        <template #prepend>
          <v-avatar size="48" color="surface-variant" class="mr-4">
            <v-img v-if="user.avatar_url" :src="user.avatar_url" />
            <v-icon v-else icon="mdi-account" />
          </v-avatar>
        </template>

        <v-list-item-title class="text-subtitle-1 font-weight-bold">
          {{ user.display_name || user.username }}
        </v-list-item-title>

        <v-list-item-subtitle>
          {{ user.username }} • {{ $t(`auth.${user.role}_role`) }}
        </v-list-item-subtitle>

        <template #append>
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    icon="mdi-dots-vertical"
                    variant="text"
                    v-bind="props"
                    @click.stop
                  />
                </template>
                <v-list>
                  <v-list-item
                    prepend-icon="mdi-pencil"
                    :title="$t('auth.edit_user')"
                    @click.stop="editUser(user)"
                  />
                  <v-list-item
                    prepend-icon="mdi-key"
                    :title="$t('auth.manage_tokens')"
                    @click.stop="manageTokens(user)"
                  />
                  <v-list-item
                    v-if="!isCurrentUser(user)"
                    :prepend-icon="user.enabled ? 'mdi-monitor-off' : 'mdi-monitor'"
                    :title="user.enabled ? $t('auth.disable_user') : $t('auth.enable_user')"
                    @click.stop="user.enabled ? confirmDisableUser(user) : enableUser(user)"
                  />
                  <v-divider v-if="!isCurrentUser(user)" />
                  <v-list-item
                    v-if="!isCurrentUser(user)"
                    prepend-icon="mdi-delete"
                    :title="$t('auth.delete_user')"
                    color="error"
                    @click.stop="confirmDeleteUser(user)"
                  />
                </v-list>
              </v-menu>
            </template>
          
          <div v-if="!user.enabled" class="mt-2">
            <v-chip color="error" size="small" variant="flat">
              {{ $t("auth.disabled") }}
            </v-chip>
          </div>
      </v-list-item>
    </v-list>

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
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

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

<style scoped>
.hover-card {
  transition: background-color 0.2s;
}
.hover-card:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}
</style>
