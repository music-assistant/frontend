<template>
  <div>
    <Container variant="comfortable">
      <!-- User Info Card -->
      <v-card class="mb-4">
        <v-card-title class="pb-6">{{
          $t("auth.account_settings")
        }}</v-card-title>
        <v-card-text>
          <v-alert v-if="profileError" type="error" class="mb-4">
            {{ profileError }}
          </v-alert>
          <v-alert v-if="profileSuccess" type="success" class="mb-4">
            {{ $t("auth.profile_updated") }}
          </v-alert>

          <!-- Avatar Section -->
          <div class="d-flex flex-column align-center mb-6">
            <v-avatar size="120" color="primary" class="mb-3">
              <v-img
                v-if="editedAvatarUrl"
                :src="editedAvatarUrl"
                @error="avatarError = true"
              />
              <v-icon v-else icon="mdi-account" size="64" />
            </v-avatar>
            <v-btn
              variant="outlined"
              size="small"
              prepend-icon="mdi-camera"
              @click="showAvatarDialog = true"
            >
              {{ $t("auth.change_avatar") }}
            </v-btn>
          </div>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editedUsername"
                :label="$t('auth.username')"
                variant="outlined"
                :rules="[rules.required, rules.usernameLength]"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="editedDisplayName"
                :label="$t('auth.display_name')"
                variant="outlined"
                hint="Optional"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                :model-value="$t(`auth.${user?.role}_role`)"
                :label="$t('auth.role')"
                variant="outlined"
                readonly
              />
            </v-col>
          </v-row>

          <v-btn
            color="primary"
            :loading="updatingProfile"
            :disabled="!hasProfileChanges"
            @click="handleUpdateProfile"
          >
            {{ $t("save") }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Change Password Card -->
      <v-card class="mb-4">
        <v-card-title class="pb-6">{{
          $t("auth.change_password")
        }}</v-card-title>
        <v-card-text>
          <v-alert v-if="passwordError" type="error" class="mb-4">
            {{ passwordError }}
          </v-alert>
          <v-alert v-if="passwordSuccess" type="success" class="mb-4">
            {{ $t("auth.password_changed") }}
          </v-alert>

          <v-form ref="passwordForm" @submit.prevent="handleChangePassword">
            <v-text-field
              v-model="oldPassword"
              :label="$t('auth.old_password')"
              type="password"
              variant="outlined"
              class="mb-2"
            />

            <v-text-field
              v-model="newPassword"
              :label="$t('auth.new_password')"
              type="password"
              variant="outlined"
              class="mb-2"
              :rules="[rules.passwordLength]"
            />

            <v-text-field
              v-model="confirmNewPassword"
              :label="$t('auth.confirm_password')"
              type="password"
              variant="outlined"
              class="mb-4"
              :rules="[rules.passwordMatch]"
            />

            <v-btn
              type="submit"
              color="primary"
              :loading="changingPassword"
              :disabled="!canChangePassword"
            >
              {{ $t("auth.change_password") }}
            </v-btn>
          </v-form>
        </v-card-text>
      </v-card>

      <!-- Active Sessions Card -->
      <v-card class="mb-4">
        <v-card-title>{{ $t("auth.active_sessions") }}</v-card-title>
        <v-card-text>
          <v-list v-if="sessionTokens.length > 0">
            <v-list-item v-for="token in sessionTokens" :key="token.token_id">
              <template #prepend>
                <v-icon icon="mdi-devices" />
              </template>
              <v-list-item-title>{{ token.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("created") }}: {{ formatDate(token.created_at) }}
                <span v-if="token.last_used_at">
                  • {{ $t("last_used") }}: {{ formatDate(token.last_used_at) }}
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
          <div v-else class="text-center pa-4 text-medium-emphasis">
            {{ $t("no_content") }}
          </div>
        </v-card-text>
      </v-card>

      <!-- Long-Lived Access Tokens Card -->
      <v-card>
        <v-card-title class="d-flex align-center">
          <span>{{ $t("auth.long_lived_tokens") }}</span>
          <v-spacer />
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            @click="showCreateTokenDialog = true"
          >
            {{ $t("auth.create_token") }}
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-list v-if="longLivedTokens.length > 0">
            <v-list-item
              v-for="token in longLivedTokens"
              :key="token.token_id"
            >
              <template #prepend>
                <v-icon icon="mdi-key-variant" />
              </template>
              <v-list-item-title>{{ token.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ $t("created") }}: {{ formatDate(token.created_at) }}
                <span v-if="token.last_used_at">
                  • {{ $t("last_used") }}: {{ formatDate(token.last_used_at) }}
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
          <div v-else class="text-center pa-4 text-medium-emphasis">
            {{ $t("no_content") }}
          </div>
        </v-card-text>
      </v-card>
    </Container>

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
    <v-dialog v-model="showRevokeDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("auth.revoke_token") }}</v-card-title>
        <v-card-text>
          {{ $t("are_you_sure") }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showRevokeDialog = false">{{ $t("cancel") }}</v-btn>
          <v-btn color="error" @click="handleRevokeToken">
            {{ $t("auth.revoke_token") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Change Avatar Dialog -->
    <v-dialog v-model="showAvatarDialog" max-width="500">
      <v-card>
        <v-card-title>{{ $t("auth.change_avatar") }}</v-card-title>
        <v-card-text>
          <div class="d-flex flex-column align-center mb-4">
            <v-avatar size="120" color="primary" class="mb-3">
              <v-img
                v-if="tempAvatarUrl"
                :src="tempAvatarUrl"
                @error="avatarError = true"
              />
              <v-icon v-else icon="mdi-account" size="64" />
            </v-avatar>
          </div>

          <v-text-field
            v-model="tempAvatarUrl"
            :label="$t('auth.avatar_url')"
            variant="outlined"
            hint="Enter URL to avatar image"
            persistent-hint
            clearable
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeAvatarDialog">{{ $t("cancel") }}</v-btn>
          <v-btn color="primary" @click="handleAvatarChange">
            {{ $t("save") }}
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
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import type { AuthToken } from "@/plugins/api/interfaces";

const { t } = useI18n();

const user = computed(() => store.currentUser);
const tokens = ref<AuthToken[]>([]);

// Separate tokens by type
const sessionTokens = computed(() =>
  tokens.value.filter((token) => !token.is_long_lived),
);
const longLivedTokens = computed(() =>
  tokens.value.filter((token) => token.is_long_lived),
);

// Edit profile
const editedUsername = ref("");
const editedDisplayName = ref("");
const editedAvatarUrl = ref("");
const updatingProfile = ref(false);
const profileError = ref("");
const profileSuccess = ref(false);

// Avatar
const showAvatarDialog = ref(false);
const tempAvatarUrl = ref("");
const avatarError = ref(false);

// Change password
const oldPassword = ref("");
const newPassword = ref("");
const confirmNewPassword = ref("");
const changingPassword = ref(false);
const passwordError = ref("");
const passwordSuccess = ref(false);

// Create token
const showCreateTokenDialog = ref(false);
const newTokenName = ref("");
const newTokenValue = ref("");
const creatingToken = ref(false);

// Revoke token
const showRevokeDialog = ref(false);
const tokenToRevoke = ref<AuthToken | null>(null);

const rules = {
  required: (v: string) => !!v || t("auth.field_required"),
  usernameLength: (v: string) => v.length >= 3 || t("auth.username_min_length"),
  passwordLength: (v: string) => v.length >= 8 || t("auth.password_min_length"),
  passwordMatch: (v: string) =>
    v === newPassword.value || t("auth.passwords_must_match"),
};

const hasProfileChanges = computed(() => {
  if (!user.value) return false;
  return (
    editedUsername.value !== user.value.username ||
    editedDisplayName.value !== (user.value.display_name || "") ||
    editedAvatarUrl.value !== (user.value.avatar_url || "")
  );
});

const canChangePassword = computed(() => {
  return (
    oldPassword.value &&
    newPassword.value.length >= 8 &&
    newPassword.value === confirmNewPassword.value
  );
});

const handleUpdateProfile = async () => {
  if (!user.value || !hasProfileChanges.value) return;

  profileError.value = "";
  profileSuccess.value = false;
  updatingProfile.value = true;

  try {
    const updates: {
      username?: string;
      displayName?: string;
      avatarUrl?: string;
    } = {};

    if (editedUsername.value !== user.value.username) {
      updates.username = editedUsername.value;
    }
    if (editedDisplayName.value !== (user.value.display_name || "")) {
      updates.displayName = editedDisplayName.value;
    }
    if (editedAvatarUrl.value !== (user.value.avatar_url || "")) {
      updates.avatarUrl = editedAvatarUrl.value;
    }

    const updatedUser = await api.updateUser(user.value.user_id, updates);

    if (updatedUser) {
      // Update store with new user data
      store.currentUser = updatedUser;
      profileSuccess.value = true;
      // Reset edited values to match new user data
      editedUsername.value = updatedUser.username;
      editedDisplayName.value = updatedUser.display_name || "";
      editedAvatarUrl.value = updatedUser.avatar_url || "";
    }
  } catch (error: any) {
    profileError.value = error.message || t("error_generic");
  } finally {
    updatingProfile.value = false;
  }
};

const closeAvatarDialog = () => {
  showAvatarDialog.value = false;
  tempAvatarUrl.value = editedAvatarUrl.value;
  avatarError.value = false;
};

const handleAvatarChange = () => {
  editedAvatarUrl.value = tempAvatarUrl.value;
  showAvatarDialog.value = false;
  avatarError.value = false;
};

const handleChangePassword = async () => {
  passwordError.value = "";
  passwordSuccess.value = false;
  changingPassword.value = true;

  try {
    const success = await api.changePassword(
      oldPassword.value,
      newPassword.value,
    );

    if (success) {
      passwordSuccess.value = true;
      oldPassword.value = "";
      newPassword.value = "";
      confirmNewPassword.value = "";
    } else {
      passwordError.value = t("auth.password_change_failed");
    }
  } catch (error: any) {
    passwordError.value = error.message || t("auth.password_change_failed");
  } finally {
    changingPassword.value = false;
  }
};

const loadTokens = async () => {
  try {
    tokens.value = await api.getUserTokens();
  } catch (error) {
    console.error("Failed to load tokens:", error);
  }
};

const handleCreateToken = async () => {
  creatingToken.value = true;

  try {
    const token = await api.createToken(newTokenName.value);
    if (token) {
      newTokenValue.value = token;
      await loadTokens();
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
  showRevokeDialog.value = true;
};

const handleRevokeToken = async () => {
  if (!tokenToRevoke.value) return;

  try {
    const success = await api.revokeToken(tokenToRevoke.value.token_id);
    if (success) {
      await loadTokens();
    }
  } catch (error) {
    console.error("Failed to revoke token:", error);
  } finally {
    showRevokeDialog.value = false;
    tokenToRevoke.value = null;
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

onMounted(() => {
  // Initialize editable fields with current user data
  if (user.value) {
    editedUsername.value = user.value.username;
    editedDisplayName.value = user.value.display_name || "";
    editedAvatarUrl.value = user.value.avatar_url || "";
    tempAvatarUrl.value = user.value.avatar_url || "";
  }
  loadTokens();
});
</script>
