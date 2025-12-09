<template>
  <div class="profile-settings">
    <div class="section-header">
      <h3>{{ $t("auth.account_settings") }}</h3>
      <p class="section-subtitle">
        {{ $t("auth.manage_your_profile_info") }}
      </p>
    </div>
    <div class="avatar-section">
      <div class="avatar-container">
        <div class="avatar-wrapper">
          <v-avatar
            size="120"
            class="profile-avatar"
            :color="editedAvatarUrl ? undefined : 'grey-darken-2'"
          >
            <v-img
              v-if="editedAvatarUrl"
              :src="editedAvatarUrl"
              @error="avatarError = true"
            />
            <v-icon
              v-else
              icon="mdi-account"
              size="64"
              color="grey-lighten-1"
            />
          </v-avatar>
          <v-btn
            icon="mdi-camera"
            size="small"
            variant="elevated"
            class="avatar-edit-btn"
            color="surface"
            @click="showAvatarDialog = true"
          />
        </div>
        <div class="avatar-text mt-2">
          <v-btn
            variant="text"
            size="small"
            class="text-capitalize"
            @click="showAvatarDialog = true"
          >
            {{ $t("auth.change_avatar") }}
          </v-btn>
        </div>
      </div>
      <div class="profile-fields">
        <v-text-field
          v-model="editedUsername"
          :label="$t('auth.username')"
          variant="outlined"
          density="comfortable"
          :rules="[rules.required, rules.usernameLength]"
          class="mb-2"
        />
        <v-text-field
          v-model="editedDisplayName"
          :label="$t('auth.display_name')"
          variant="outlined"
          density="comfortable"
          :hint="$t('optional')"
          persistent-hint
          class="mb-2"
        />
        <v-text-field
          :model-value="$t(`auth.${user?.role}_role`)"
          :label="$t('auth.role')"
          variant="outlined"
          density="comfortable"
          readonly
          disabled
        />
      </div>
    </div>
    <div class="actions">
      <v-btn v-if="hasChanges" variant="text" color="grey" @click="resetFields">
        {{ $t("cancel") }}
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="updating"
        :disabled="!hasChanges"
        @click="handleUpdate"
      >
        {{ $t("save") }}
      </v-btn>
    </div>
    <v-dialog v-model="showAvatarDialog" max-width="500">
      <v-card>
        <v-card-title class="text-h5">{{
          $t("auth.change_avatar")
        }}</v-card-title>
        <v-card-text>
          <div class="d-flex flex-column align-center mb-4">
            <v-avatar
              size="140"
              :color="tempAvatarUrl ? undefined : 'grey-darken-2'"
            >
              <v-img
                v-if="tempAvatarUrl"
                :src="tempAvatarUrl"
                @error="avatarError = true"
              />
              <v-icon
                v-else
                icon="mdi-account"
                size="72"
                color="grey-lighten-1"
              />
            </v-avatar>
          </div>
          <v-text-field
            v-model="tempAvatarUrl"
            :label="$t('auth.avatar_url')"
            variant="outlined"
            :hint="$t('auth.avatar_url_hint')"
            persistent-hint
            clearable
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeAvatarDialog">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="handleAvatarChange">
            {{ $t("save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

const { t } = useI18n();

const user = computed(() => store.currentUser);

const editedUsername = ref("");
const editedDisplayName = ref("");
const editedAvatarUrl = ref("");
const updating = ref(false);

const showAvatarDialog = ref(false);
const tempAvatarUrl = ref("");
const avatarError = ref(false);

const rules = {
  required: (v: string) => !!v || t("auth.field_required"),
  usernameLength: (v: string) => v.length >= 3 || t("auth.username_min_length"),
};

const hasChanges = computed(() => {
  if (!user.value) return false;
  return (
    editedUsername.value !== user.value.username ||
    editedDisplayName.value !== (user.value.display_name || "") ||
    editedAvatarUrl.value !== (user.value.avatar_url || "")
  );
});

const resetFields = () => {
  if (user.value) {
    editedUsername.value = user.value.username;
    editedDisplayName.value = user.value.display_name || "";
    editedAvatarUrl.value = user.value.avatar_url || "";
    tempAvatarUrl.value = user.value.avatar_url || "";
  }
};

const handleUpdate = async () => {
  if (!user.value || !hasChanges.value) return;

  updating.value = true;

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
      store.currentUser = updatedUser;
      resetFields();
      toast.success(t("auth.profile_updated"));
    }
  } catch (err: any) {
    toast.error(err.message || t("error_generic"));
  } finally {
    updating.value = false;
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

watch(user, resetFields, { immediate: true });
</script>

<style scoped>
.profile-settings {
  margin-bottom: 24px;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  margin-bottom: 4px;
  font-weight: 500;
}

.section-subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.813rem;
  margin: 0;
  line-height: 1.4;
}

.avatar-section {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 160px;
}

.avatar-wrapper {
  position: relative;
  display: inline-block;
}

.profile-avatar {
  border: 3px solid rgba(var(--v-border-color), 0.2);
  transition: all 0.3s ease;
}

.avatar-wrapper:hover .profile-avatar {
  border-color: rgba(var(--v-theme-primary), 0.5);
}

.avatar-edit-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.avatar-text {
  text-align: center;
}

.profile-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.profile-avatar .v-icon {
  margin: 0 !important;
}

.profile-fields {
  flex: 1;
  min-width: 280px;
}

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

@media (max-width: 600px) {
  .avatar-section {
    flex-direction: column;
    align-items: center;
  }

  .profile-fields {
    width: 100%;
  }
}
</style>
