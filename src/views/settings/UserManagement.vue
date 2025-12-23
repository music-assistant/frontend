<template>
  <div>
    <div class="users-header w-100">
      <v-text-field
        v-model="searchQuery"
        :placeholder="$t('search')"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="compact"
        hide-details
        clearable
        style="max-width: 400px"
      />
      <v-btn
        color="primary"
        variant="flat"
        height="40"
        class="add-user-btn"
        prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        {{ $t("auth.create_user") }}
      </v-btn>
    </div>
    <Container>
      <ListItem
        v-for="user in filteredUsers"
        :key="user.user_id"
        show-menu-btn
        link
        @menu="(evt: Event) => onMenu(evt, user)"
        @click="editUser(user)"
      >
        <template #prepend>
          <div class="user-avatar-wrapper">
            <v-avatar
              size="40"
              :color="user.avatar_url ? undefined : 'grey-darken-2'"
            >
              <v-img v-if="user.avatar_url" :src="user.avatar_url" />
              <v-icon
                v-else
                icon="mdi-account"
                size="20"
                color="grey-lighten-1"
              />
            </v-avatar>
          </div>
        </template>
        <template #title>
          <div class="ma-line-clamp-1">
            {{ user.display_name || user.username }}
          </div>
        </template>
        <template #subtitle>
          <div class="ma-line-clamp-1">
            {{ user.username }} • {{ $t(`auth.${user.role}_role`) }}
          </div>
        </template>
        <template #append>
          <v-chip v-if="!user.enabled" size="small" color="error">
            {{ $t("auth.disabled") }}
          </v-chip>
        </template>
      </ListItem>
      <div
        v-if="users.length === 0"
        class="text-center pa-8 text-medium-emphasis"
      >
        {{ $t("no_content") }}
      </div>
    </Container>
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
import Container from "@/components/Container.vue";
import ListItem from "@/components/ListItem.vue";
import CreateUserDialog from "@/components/users/CreateUserDialog.vue";
import DeleteUserDialog from "@/components/users/DeleteUserDialog.vue";
import DisableUserDialog from "@/components/users/DisableUserDialog.vue";
import EditUserDialog from "@/components/users/EditUserDialog.vue";
import ManageTokensDialog from "@/components/users/ManageTokensDialog.vue";
import RevokeTokenDialog from "@/components/users/RevokeTokenDialog.vue";
import { api } from "@/plugins/api";
import type { AuthToken, User } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

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

const onMenu = (evt: Event, user: User) => {
  const menuItems = [
    {
      label: "auth.edit_user",
      labelArgs: [],
      action: () => {
        editUser(user);
      },
      icon: "mdi-pencil",
    },
    {
      label: "auth.manage_tokens",
      labelArgs: [],
      action: () => {
        manageTokens(user);
      },
      icon: "mdi-key-variant",
    },
    {
      label: user.enabled ? "auth.disable_user" : "auth.enable_user",
      labelArgs: [],
      action: () => {
        if (user.enabled) {
          confirmDisableUser(user);
        } else {
          enableUser(user);
        }
      },
      icon: user.enabled ? "mdi-account-off" : "mdi-account-check",
      hide: isCurrentUser(user),
    },
    {
      label: "auth.delete_user",
      labelArgs: [],
      action: () => {
        confirmDeleteUser(user);
      },
      icon: "mdi-delete",
      color: "error",
      hide: isCurrentUser(user),
    },
  ];
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.users-header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px 20px 6px 20px;
}

.add-user-btn {
  flex-shrink: 0;
  align-self: center;
}

@media (max-width: 960px) {
  .users-header {
    flex-direction: column;
    align-items: stretch;
  }

  .add-user-btn {
    width: 100%;
    align-self: stretch;
  }
}

.user-avatar-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar-wrapper :deep(.v-icon) {
  margin-inline-end: 0 !important;
}

.user-avatar-wrapper :deep(.v-avatar) {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.user-avatar-wrapper :deep(.v-avatar .v-icon) {
  margin: 0 !important;
}
</style>
