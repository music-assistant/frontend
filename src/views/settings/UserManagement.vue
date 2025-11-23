<template>
  <div>
    <div class="providers-header w-100">
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
        variant="outlined"
        height="40"
        class="add-provider-btn"
        prepend-icon="mdi-plus"
        @click="showCreateUserDialog = true"
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
              :color="user.avatar_url ? undefined : 'primary'"
            >
              <v-img v-if="user.avatar_url" :src="user.avatar_url" />
              <v-icon
                v-else
                icon="mdi-account"
                size="20"
                color="white"
                style="margin-left: 5px"
              />
            </v-avatar>
          </div>
        </template>

        <template #title>
          <div class="line-clamp-1">
            {{ user.display_name || user.username }}
          </div>
        </template>

        <template #subtitle>
          <div class="line-clamp-1">
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

    <!-- Create User Dialog -->
    <v-dialog v-model="showCreateUserDialog" max-width="600">
      <v-card>
        <v-card-title>{{ $t("auth.create_user") }}</v-card-title>
        <v-card-text>
          <v-alert v-if="createUserError" type="error" class="mb-4">
            {{ createUserError }}
          </v-alert>

          <v-text-field
            v-model="newUser.username"
            :label="$t('auth.username')"
            variant="outlined"
            class="mb-2"
            :rules="[rules.required, rules.usernameLength]"
          />

          <v-text-field
            v-model="newUser.displayName"
            :label="$t('auth.display_name')"
            variant="outlined"
            class="mb-2"
            hint="Optional"
          />

          <v-text-field
            v-model="newUser.password"
            :label="$t('auth.password')"
            type="password"
            variant="outlined"
            class="mb-2"
            :rules="[rules.required, rules.passwordLength]"
          />

          <v-select
            v-model="newUser.role"
            :label="$t('auth.role')"
            :items="roleOptions"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeCreateUserDialog">{{ $t("cancel") }}</v-btn>
          <v-btn
            color="primary"
            :loading="creatingUser"
            :disabled="!canCreateUser"
            @click="handleCreateUser"
          >
            {{ $t("create") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit User Dialog -->
    <v-dialog v-model="showEditUserDialog" max-width="600">
      <v-card>
        <v-card-title>{{ $t("auth.edit_user") }}</v-card-title>
        <v-card-text>
          <v-alert v-if="editUserError" type="error" class="mb-4">
            {{ editUserError }}
          </v-alert>

          <v-text-field
            v-model="editedUser.username"
            :label="$t('auth.username')"
            variant="outlined"
            class="mb-2"
            :rules="[rules.required, rules.usernameLength]"
          />

          <v-text-field
            v-model="editedUser.displayName"
            :label="$t('auth.display_name')"
            variant="outlined"
            class="mb-2"
            hint="Optional"
          />

          <v-text-field
            v-model="editedUser.avatarUrl"
            :label="$t('auth.avatar_url')"
            variant="outlined"
            class="mb-2"
            hint="Optional - URL to avatar image"
          />

          <v-select
            v-model="editedUser.role"
            :label="$t('auth.role')"
            :items="roleOptions"
            variant="outlined"
            :disabled="isCurrentUser(userToModify!)"
            class="mb-2"
          />

          <v-text-field
            v-model="editedUser.password"
            :label="$t('auth.new_password')"
            type="password"
            variant="outlined"
            hint="Leave blank to keep current password"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeEditUserDialog">{{ $t("cancel") }}</v-btn>
          <v-btn
            color="primary"
            :loading="updatingUser"
            @click="handleUpdateUser"
          >
            {{ $t("save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Disable User Dialog -->
    <v-dialog v-model="showDisableDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("auth.disable_user") }}</v-card-title>
        <v-card-text>
          {{ $t("auth.confirm_disable_user") }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDisableDialog = false">{{ $t("cancel") }}</v-btn>
          <v-btn color="error" @click="handleDisableUser">
            {{ $t("auth.disable_user") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete User Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("auth.delete_user") }}</v-card-title>
        <v-card-text>
          {{ $t("auth.confirm_delete_user") }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showDeleteDialog = false">{{ $t("cancel") }}</v-btn>
          <v-btn color="error" @click="handleDeleteUser">
            {{ $t("auth.delete_user") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Manage Tokens Dialog -->
    <v-dialog v-model="showTokensDialog" max-width="900" scrollable>
      <v-card>
        <v-card-title>
          {{ $t("auth.tokens") }} -
          {{ userToModify?.display_name || userToModify?.username }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-0">
          <!-- Active Sessions Section -->
          <div class="pa-4">
            <div class="text-h6 mb-2">{{ $t("auth.active_sessions") }}</div>
            <div class="text-caption text-medium-emphasis mb-3">
              {{ $t("auth.active_sessions_description") }}
            </div>
            <v-list v-if="userSessionTokens.length > 0">
              <v-list-item
                v-for="token in userSessionTokens"
                :key="token.token_id"
              >
                <template #prepend>
                  <v-icon icon="mdi-devices" />
                </template>
                <v-list-item-title>{{ token.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ $t("created") }}: {{ formatDate(token.created_at) }}
                  <span v-if="token.last_used_at">
                    • {{ $t("last_used") }}:
                    {{ formatDate(token.last_used_at) }}
                  </span>
                </v-list-item-subtitle>
                <template #append>
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    @click="confirmRevokeToken(token)"
                  />
                </template>
              </v-list-item>
            </v-list>
            <div
              v-else
              class="text-center pa-4 text-medium-emphasis bg-surface-variant rounded"
            >
              {{ $t("auth.no_active_sessions") }}
            </div>
          </div>

          <v-divider />

          <!-- Long-Lived Access Tokens Section -->
          <div class="pa-4">
            <div class="d-flex align-center mb-2">
              <div class="text-h6">{{ $t("auth.long_lived_tokens") }}</div>
              <v-spacer />
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                size="small"
                @click="showCreateTokenDialog = true"
              >
                {{ $t("auth.create_token") }}
              </v-btn>
            </div>
            <div class="text-caption text-medium-emphasis mb-3">
              {{ $t("auth.long_lived_tokens_description") }}
            </div>
            <v-list v-if="userLongLivedTokens.length > 0">
              <v-list-item
                v-for="token in userLongLivedTokens"
                :key="token.token_id"
              >
                <template #prepend>
                  <v-icon icon="mdi-key-variant" />
                </template>
                <v-list-item-title>{{ token.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ $t("created") }}: {{ formatDate(token.created_at) }}
                  <span v-if="token.last_used_at">
                    • {{ $t("last_used") }}:
                    {{ formatDate(token.last_used_at) }}
                  </span>
                </v-list-item-subtitle>
                <template #append>
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    @click="confirmRevokeToken(token)"
                  />
                </template>
              </v-list-item>
            </v-list>
            <div
              v-else
              class="text-center pa-4 text-medium-emphasis bg-surface-variant rounded"
            >
              {{ $t("auth.no_long_lived_tokens") }}
            </div>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeTokensDialog">{{ $t("close") }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Create Token Dialog -->
    <v-dialog v-model="showCreateTokenDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t("auth.create_token") }}</v-card-title>
        <v-card-text>
          <v-alert v-if="newTokenValue" type="success" class="mb-4">
            <div class="mb-2">{{ $t("auth.token_created") }}</div>
            <div class="mb-2 font-weight-bold">{{ newTokenValue }}</div>
            <div class="text-caption">{{ $t("auth.token_warning") }}</div>
            <v-btn size="small" color="white" class="mt-2" @click="copyToken">
              {{ $t("auth.copy_token") }}
            </v-btn>
          </v-alert>

          <v-text-field
            v-if="!newTokenValue"
            v-model="newTokenName"
            :label="$t('auth.token_name')"
            variant="outlined"
            hint="e.g., 'Home Assistant', 'Mobile App'"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeCreateTokenDialog">
            {{ $t("close") }}
          </v-btn>
          <v-btn
            v-if="!newTokenValue"
            color="primary"
            :loading="creatingToken"
            :disabled="!newTokenName"
            @click="handleCreateToken"
          >
            {{ $t("create") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Revoke Token Dialog -->
    <v-dialog v-model="showRevokeTokenDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("auth.revoke_token") }}</v-card-title>
        <v-card-text>
          {{ $t("are_you_sure") }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showRevokeTokenDialog = false">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn color="error" @click="handleRevokeToken">
            {{ $t("auth.revoke_token") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import Container from "@/components/Container.vue";
import ListItem from "@/components/ListItem.vue";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import { eventbus } from "@/plugins/eventbus";
import type { User, AuthToken } from "@/plugins/api/interfaces";
import { UserRole } from "@/plugins/api/interfaces";

const { t } = useI18n();

const users = ref<User[]>([]);
const searchQuery = ref("");
const showCreateUserDialog = ref(false);
const showEditUserDialog = ref(false);
const showDisableDialog = ref(false);
const showDeleteDialog = ref(false);
const userToModify = ref<User | null>(null);
const creatingUser = ref(false);
const createUserError = ref("");
const updatingUser = ref(false);
const editUserError = ref("");

// Token management
const showTokensDialog = ref(false);
const showCreateTokenDialog = ref(false);
const showRevokeTokenDialog = ref(false);
const userTokens = ref<AuthToken[]>([]);
const newTokenName = ref("");
const newTokenValue = ref("");
const creatingToken = ref(false);
const tokenToRevoke = ref<AuthToken | null>(null);

// Separate tokens by type
const userSessionTokens = computed(() =>
  userTokens.value.filter((token) => !token.is_long_lived),
);
const userLongLivedTokens = computed(() =>
  userTokens.value.filter((token) => token.is_long_lived),
);

const newUser = ref({
  username: "",
  displayName: "",
  password: "",
  role: "user" as UserRole,
});

const editedUser = ref({
  username: "",
  displayName: "",
  avatarUrl: "",
  role: "user" as UserRole,
  password: "",
});

const roleOptions = [
  { title: t("auth.admin_role"), value: "admin" },
  { title: t("auth.user_role"), value: "user" },
];

const rules = {
  required: (v: string) => !!v || t("auth.field_required"),
  usernameLength: (v: string) => v.length >= 3 || t("auth.username_min_length"),
  passwordLength: (v: string) => v.length >= 8 || t("auth.password_min_length"),
};

const canCreateUser = computed(() => {
  return (
    newUser.value.username.length >= 3 &&
    newUser.value.password.length >= 8 &&
    newUser.value.role
  );
});

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
  } catch (error: any) {
    console.error("Failed to load users:", error);
  }
};

const handleCreateUser = async () => {
  createUserError.value = "";
  creatingUser.value = true;

  try {
    const user = await api.createUser(
      newUser.value.username,
      newUser.value.password,
      newUser.value.role,
      newUser.value.displayName || undefined,
    );

    if (user) {
      await loadUsers();
      closeCreateUserDialog();
    }
  } catch (error: any) {
    createUserError.value = error.message || t("error_generic");
  } finally {
    creatingUser.value = false;
  }
};

const closeCreateUserDialog = () => {
  showCreateUserDialog.value = false;
  newUser.value = {
    username: "",
    displayName: "",
    password: "",
    role: UserRole.USER,
  };
  createUserError.value = "";
};

const confirmDisableUser = (user: User) => {
  userToModify.value = user;
  showDisableDialog.value = true;
};

const handleDisableUser = async () => {
  if (!userToModify.value) return;

  try {
    await api.disableUser(userToModify.value.user_id);
    await loadUsers();
  } catch (error) {
    console.error("Failed to disable user:", error);
  } finally {
    showDisableDialog.value = false;
    userToModify.value = null;
  }
};

const enableUser = async (user: User) => {
  try {
    await api.enableUser(user.user_id);
    await loadUsers();
  } catch (error) {
    console.error("Failed to enable user:", error);
  }
};

const editUser = (user: User) => {
  userToModify.value = user;
  editedUser.value = {
    username: user.username,
    displayName: user.display_name || "",
    avatarUrl: user.avatar_url || "",
    role: user.role,
    password: "",
  };
  showEditUserDialog.value = true;
};

const closeEditUserDialog = () => {
  showEditUserDialog.value = false;
  userToModify.value = null;
  editedUser.value = {
    username: "",
    displayName: "",
    avatarUrl: "",
    role: UserRole.USER,
    password: "",
  };
  editUserError.value = "";
};

const handleUpdateUser = async () => {
  if (!userToModify.value) return;

  editUserError.value = "";
  updatingUser.value = true;

  try {
    const updates: {
      username?: string;
      displayName?: string;
      avatarUrl?: string;
      role?: UserRole;
      password?: string;
    } = {};

    if (editedUser.value.username !== userToModify.value.username) {
      updates.username = editedUser.value.username;
    }
    if (
      editedUser.value.displayName !== (userToModify.value.display_name || "")
    ) {
      updates.displayName = editedUser.value.displayName;
    }
    if (editedUser.value.avatarUrl !== (userToModify.value.avatar_url || "")) {
      updates.avatarUrl = editedUser.value.avatarUrl;
    }
    if (
      editedUser.value.role !== userToModify.value.role &&
      !isCurrentUser(userToModify.value)
    ) {
      updates.role = editedUser.value.role;
    }
    if (editedUser.value.password) {
      updates.password = editedUser.value.password;
    }

    await api.updateUser(userToModify.value.user_id, updates);
    await loadUsers();
    closeEditUserDialog();
  } catch (error: any) {
    editUserError.value = error.message || t("error_generic");
  } finally {
    updatingUser.value = false;
  }
};

const confirmDeleteUser = (user: User) => {
  userToModify.value = user;
  showDeleteDialog.value = true;
};

const handleDeleteUser = async () => {
  if (!userToModify.value) return;

  try {
    await api.deleteUser(userToModify.value.user_id);
    await loadUsers();
  } catch (error) {
    console.error("Failed to delete user:", error);
  } finally {
    showDeleteDialog.value = false;
    userToModify.value = null;
  }
};

const loadUserTokens = async (userId: string) => {
  try {
    userTokens.value = await api.getUserTokens(userId);
  } catch (error) {
    console.error("Failed to load tokens:", error);
  }
};

const manageTokens = async (user: User) => {
  userToModify.value = user;
  await loadUserTokens(user.user_id);
  showTokensDialog.value = true;
};

const closeTokensDialog = () => {
  showTokensDialog.value = false;
  userToModify.value = null;
  userTokens.value = [];
};

const handleCreateToken = async () => {
  if (!userToModify.value) return;

  creatingToken.value = true;

  try {
    const token = await api.createToken(
      newTokenName.value,
      userToModify.value.user_id,
    );
    if (token) {
      newTokenValue.value = token;
      await loadUserTokens(userToModify.value.user_id);
    }
  } catch (error) {
    console.error("Failed to create token:", error);
  } finally {
    creatingToken.value = false;
  }
};

const closeCreateTokenDialog = () => {
  showCreateTokenDialog.value = false;
  newTokenName.value = "";
  newTokenValue.value = "";
};

const copyToken = async () => {
  try {
    await navigator.clipboard.writeText(newTokenValue.value);
  } catch (error) {
    console.error("Failed to copy token:", error);
  }
};

const confirmRevokeToken = (token: AuthToken) => {
  tokenToRevoke.value = token;
  showRevokeTokenDialog.value = true;
};

const handleRevokeToken = async () => {
  if (!tokenToRevoke.value || !userToModify.value) return;

  try {
    const success = await api.revokeToken(tokenToRevoke.value.token_id);
    if (success) {
      await loadUserTokens(userToModify.value.user_id);
    }
  } catch (error) {
    console.error("Failed to revoke token:", error);
  } finally {
    showRevokeTokenDialog.value = false;
    tokenToRevoke.value = null;
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
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
.providers-header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px 20px 6px 20px;
}

.add-provider-btn {
  flex-shrink: 0;
  align-self: center;
}

/* Mobile responsive */
@media (max-width: 960px) {
  .providers-header {
    flex-direction: column;
    align-items: stretch;
  }

  .add-provider-btn {
    width: 100%;
    align-self: stretch;
  }
}

/* User avatar wrapper - isolate from ListItem CSS */
.user-avatar-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Override ListItem's margin on icon inside avatar */
.user-avatar-wrapper :deep(.v-icon) {
  margin-inline-end: 0 !important;
}
</style>
