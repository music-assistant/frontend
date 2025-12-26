<template>
  <div>
    <v-card>
      <v-card-title>{{ $t("auth.account_settings") }}</v-card-title>
      <v-card-subtitle>
        {{ $t("auth.manage_your_profile_info") }}
      </v-card-subtitle>
      <v-card-text>
        <form id="form-profile-settings" @submit.prevent="form.handleSubmit">
          <div class="d-flex flex-column flex-sm-row gap-4 mb-6">
            <div class="d-flex flex-column align-center gap-3">
              <div class="position-relative">
                <v-avatar size="128" color="grey-lighten-2">
                  <v-img
                    v-if="
                      (currentAvatarUrl ||
                        form.state.values.avatarUrl ||
                        user?.avatar_url) &&
                      !avatarError
                    "
                    :src="
                      currentAvatarUrl ||
                      form.state.values.avatarUrl ||
                      user?.avatar_url ||
                      ''
                    "
                    cover
                    @error="avatarError = true"
                  />
                  <v-icon
                    v-else
                    icon="mdi-account"
                    size="64"
                    color="grey-darken-2"
                  />
                </v-avatar>
                <v-btn
                  v-if="!isIngressSession"
                  icon="mdi-camera"
                  variant="elevated"
                  size="small"
                  class="position-absolute bottom-0 right-0"
                  color="surface"
                  @click="showAvatarDialog = true"
                />
              </div>
            </div>

            <div class="flex-grow-1">
              <form.Field name="username">
                <template #default="{ field }">
                  <v-text-field
                    :id="field.name"
                    :name="field.name"
                    :model-value="field.state.value"
                    :label="$t('auth.username')"
                    :error-messages="field.state.meta.errors"
                    :disabled="isIngressSession"
                    autocomplete="username"
                    variant="outlined"
                    class="mb-2"
                    @blur="field.handleBlur"
                    @input="
                      (e: any) => {
                        handleUsernameInput(e, field);
                        field.handleChange(e.target.value);
                      }
                    "
                  />
                </template>
              </form.Field>

              <form.Field name="displayName">
                <template #default="{ field }">
                  <v-text-field
                    :id="field.name"
                    :name="field.name"
                    :model-value="field.state.value"
                    :label="$t('auth.display_name')"
                    :hint="$t('optional')"
                    persistent-hint
                    :error-messages="field.state.meta.errors"
                    :disabled="isIngressSession"
                    autocomplete="name"
                    variant="outlined"
                    class="mb-2"
                    @blur="field.handleBlur"
                    @input="
                      (e: any) => {
                        handleDisplayNameInput(e, field);
                        field.handleChange(e.target.value);
                      }
                    "
                  />
                </template>
              </form.Field>

              <form.Field name="role">
                <template #default="{ field }">
                  <v-text-field
                    :id="field.name"
                    :name="field.name"
                    :model-value="field.state.value"
                    :label="$t('auth.role')"
                    readonly
                    disabled
                    variant="filled"
                  />
                </template>
              </form.Field>
            </div>
          </div>
        </form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn v-if="hasChanges" variant="text" @click="handleReset">
          {{ $t("cancel") }}
        </v-btn>
        <v-btn
          type="submit"
          form="form-profile-settings"
          color="primary"
          :disabled="!hasChanges || updating"
          :loading="updating"
        >
          {{ $t("auth.save_changes") || "Save changes" }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <v-dialog v-model="showAvatarDialog" max-width="400">
      <v-card>
        <v-card-title>{{ $t("auth.change_avatar") }}</v-card-title>
        <v-card-subtitle>
          {{ $t("auth.avatar_url_hint") }}
        </v-card-subtitle>
        <v-card-text class="d-flex flex-column align-center gap-4 py-4">
          <v-avatar size="144" color="grey-lighten-2">
            <v-img
              v-if="tempAvatarUrl && !avatarError"
              :src="tempAvatarUrl"
              cover
              @error="avatarError = true"
            />
            <v-icon v-else icon="mdi-account" size="72" color="grey-darken-2" />
          </v-avatar>
          <v-text-field
            v-model="tempAvatarUrl"
            :label="$t('auth.avatar_url')"
            :placeholder="$t('auth.avatar_url_hint')"
            :hint="$t('auth.avatar_url_hint')"
            persistent-hint
            variant="outlined"
            class="w-100"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closeAvatarDialog">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn color="primary" @click="handleAvatarChange">
            {{ $t("auth.save_changes") || "Save changes" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

import { profileSettingsSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";

const { t } = useI18n();

const user = computed(() => store.currentUser);
const isIngressSession = computed(() => store.isIngressSession);

const showAvatarDialog = ref(false);
const tempAvatarUrl = ref("");
const avatarError = ref(false);
const updating = ref(false);
const originalAvatarUrl = ref("");

const currentUsername = ref("");
const currentDisplayName = ref("");
const currentAvatarUrl = ref("");

const form = useForm({
  defaultValues: {
    username: user.value?.username || "",
    displayName: user.value?.display_name || "",
    avatarUrl: user.value?.avatar_url || "",
    role: user.value ? t(`auth.${user.value.role}_role`) : "",
  },
  validators: {
    onSubmit: profileSettingsSchema(t),
  },
  onSubmit: async ({ value }) => {
    if (!user.value) return;

    updating.value = true;

    try {
      const updates: {
        username?: string;
        displayName?: string;
        avatarUrl?: string;
      } = {};

      if (value.username !== user.value.username) {
        updates.username = value.username;
      }
      if (value.displayName !== (user.value.display_name || "")) {
        updates.displayName = value.displayName;
      }
      if (value.avatarUrl !== (user.value.avatar_url || "")) {
        updates.avatarUrl = value.avatarUrl;
      }

      if (Object.keys(updates).length === 0) {
        return;
      }

      const updatedUser = await api.updateUser(user.value.user_id, updates);

      if (updatedUser) {
        store.currentUser = updatedUser;

        if (updates.username) {
          currentUsername.value = updatedUser.username || "";
        }
        if (updates.displayName !== undefined) {
          currentDisplayName.value = updatedUser.display_name || "";
        }
        if (updates.avatarUrl !== undefined) {
          currentAvatarUrl.value = updatedUser.avatar_url || "";
          form.setFieldValue("avatarUrl", updatedUser.avatar_url || "");
          avatarError.value = false;
        }
        toast.success(t("auth.profile_updated"));
      }
    } catch (err: any) {
      toast.error(err.message || t("error_generic"));
    } finally {
      updating.value = false;
    }
  },
});

const hasChanges = computed(() => {
  if (!user.value) return false;
  const username = currentUsername.value || form.state.values.username || "";
  const displayName =
    currentDisplayName.value || form.state.values.displayName || "";
  const avatarUrl = currentAvatarUrl.value || form.state.values.avatarUrl || "";
  const originalUsername = user.value.username || "";
  const originalDisplayName = user.value.display_name || "";
  const originalAvatarUrl = user.value.avatar_url || "";
  return (
    username !== originalUsername ||
    displayName !== originalDisplayName ||
    avatarUrl !== originalAvatarUrl
  );
});

const handleUsernameInput = (e: Event, field: any) => {
  const value = (e.target as HTMLInputElement).value;
  currentUsername.value = value;
};

const handleDisplayNameInput = (e: Event, field: any) => {
  const value = (e.target as HTMLInputElement).value;
  currentDisplayName.value = value;
};

const handleReset = () => {
  if (user.value) {
    const originalAvatar = user.value.avatar_url || "";
    currentUsername.value = user.value.username || "";
    currentDisplayName.value = user.value.display_name || "";
    currentAvatarUrl.value = originalAvatar;
    originalAvatarUrl.value = originalAvatar;
    form.setFieldValue("username", user.value.username);
    form.setFieldValue("displayName", user.value.display_name || "");
    form.setFieldValue("avatarUrl", originalAvatar);
    form.setFieldValue("role", t(`auth.${user.value.role}_role`));
  }
};

const closeAvatarDialog = () => {
  currentAvatarUrl.value = originalAvatarUrl.value;
  form.setFieldValue("avatarUrl", originalAvatarUrl.value);
  tempAvatarUrl.value = originalAvatarUrl.value;
  showAvatarDialog.value = false;
  avatarError.value = false;
};

const handleAvatarChange = () => {
  const newUrl = tempAvatarUrl.value;
  currentAvatarUrl.value = newUrl;
  if (newUrl !== form.state.values.avatarUrl) {
    form.setFieldValue("avatarUrl", newUrl);
  }
  showAvatarDialog.value = false;
  avatarError.value = false;
};

watch(
  () => user.value?.avatar_url,
  (newAvatarUrl) => {
    if (newAvatarUrl !== undefined) {
      currentAvatarUrl.value = newAvatarUrl || "";
      form.setFieldValue("avatarUrl", newAvatarUrl || "");
      if (!showAvatarDialog.value) {
        tempAvatarUrl.value = newAvatarUrl || "";
      }
    }
  },
  { immediate: true },
);

watch(showAvatarDialog, (isOpen) => {
  if (isOpen) {
    originalAvatarUrl.value =
      user.value?.avatar_url ||
      currentAvatarUrl.value ||
      form.state.values.avatarUrl ||
      "";
    tempAvatarUrl.value =
      currentAvatarUrl.value ||
      form.state.values.avatarUrl ||
      user.value?.avatar_url ||
      "";
    avatarError.value = false;
  }
});

watch(
  user,
  (newUser) => {
    if (newUser) {
      const username = newUser.username || "";
      const displayName = newUser.display_name || "";

      currentUsername.value = username;
      currentDisplayName.value = displayName;

      form.setFieldValue("username", username);
      form.setFieldValue("displayName", displayName);
      form.setFieldValue("role", t(`auth.${newUser.role}_role`));
    }
  },
  { immediate: true },
);

watch(tempAvatarUrl, (newValue) => {
  if (showAvatarDialog.value) {
    currentAvatarUrl.value = newValue;
    form.setFieldValue("avatarUrl", newValue);
  }
});
</script>
