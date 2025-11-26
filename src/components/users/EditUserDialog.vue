<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-h6 pa-6 pb-4">
        {{ $t("auth.edit_user") }}
      </v-card-title>
      <v-card-text class="px-6 pb-2">
        <v-text-field
          v-model="localUser.username"
          :label="$t('auth.username')"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          :rules="[rules.required, rules.usernameLength]"
        />
        <v-text-field
          v-model="localUser.displayName"
          :label="$t('auth.display_name')"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          :hint="$t('optional')"
          persistent-hint
        />
        <v-text-field
          v-model="localUser.avatarUrl"
          :label="$t('auth.avatar_url')"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          :hint="$t('auth.avatar_url_hint')"
          persistent-hint
        />
        <v-select
          v-model="localUser.role"
          :label="$t('auth.role')"
          :items="roleOptions"
          variant="outlined"
          density="comfortable"
          :disabled="isCurrentUser"
          class="mb-2"
        />
        <v-text-field
          v-model="localUser.password"
          :label="$t('auth.new_password')"
          type="password"
          variant="outlined"
          density="comfortable"
          class="mb-2"
          :hint="$t('auth.password_optional_hint')"
          persistent-hint
          :rules="localUser.password ? [rules.passwordLength] : []"
        />
        <v-text-field
          v-if="localUser.password"
          v-model="localUser.confirmPassword"
          :label="$t('auth.confirm_password')"
          type="password"
          variant="outlined"
          density="comfortable"
          :rules="[rules.passwordMatch]"
        />
      </v-card-text>
      <v-card-actions class="pa-6 pt-4">
        <v-spacer />
        <v-btn variant="text" @click="handleClose">
          {{ $t("cancel") }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          @click="handleUpdate"
        >
          {{ $t("save") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import type { User } from "@/plugins/api/interfaces";
import { UserRole } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  user: User | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  updated: [];
}>();

const loading = ref(false);

const localUser = ref({
  username: "",
  displayName: "",
  avatarUrl: "",
  role: "user" as UserRole,
  password: "",
  confirmPassword: "",
});

const roleOptions = [
  { title: t("auth.admin_role"), value: "admin" },
  { title: t("auth.user_role"), value: "user" },
];

const rules = {
  required: (v: string) => !!v || t("auth.field_required"),
  usernameLength: (v: string) => v.length >= 3 || t("auth.username_min_length"),
  passwordLength: (v: string) => v.length >= 8 || t("auth.password_min_length"),
  passwordMatch: (v: string) =>
    v === localUser.value.password || t("auth.passwords_must_match"),
};

const isCurrentUser = computed(() => {
  if (!props.user || !store.currentUser) return false;
  return props.user.user_id === store.currentUser.user_id;
});

const resetForm = () => {
  if (props.user) {
    localUser.value = {
      username: props.user.username,
      displayName: props.user.display_name || "",
      avatarUrl: props.user.avatar_url || "",
      role: props.user.role,
      password: "",
      confirmPassword: "",
    };
  } else {
    localUser.value = {
      username: "",
      displayName: "",
      avatarUrl: "",
      role: UserRole.USER,
      password: "",
      confirmPassword: "",
    };
  }
};

const handleClose = () => {
  resetForm();
  emit("update:modelValue", false);
};

const handleUpdate = async () => {
  if (!props.user) return;

  if (
    localUser.value.password &&
    localUser.value.password !== localUser.value.confirmPassword
  ) {
    toast.error(t("auth.passwords_must_match"));
    return;
  }

  loading.value = true;

  try {
    const updates: {
      username?: string;
      displayName?: string;
      avatarUrl?: string;
      role?: UserRole;
      password?: string;
    } = {};

    if (localUser.value.username !== props.user.username) {
      updates.username = localUser.value.username;
    }
    if (localUser.value.displayName !== (props.user.display_name || "")) {
      updates.displayName = localUser.value.displayName;
    }
    if (localUser.value.avatarUrl !== (props.user.avatar_url || "")) {
      updates.avatarUrl = localUser.value.avatarUrl;
    }
    if (localUser.value.role !== props.user.role && !isCurrentUser.value) {
      updates.role = localUser.value.role;
    }
    if (localUser.value.password) {
      updates.password = localUser.value.password;
    }

    await api.updateUser(props.user.user_id, updates);
    toast.success(t("auth.user_updated"));
    resetForm();
    emit("updated");
    emit("update:modelValue", false);
  } catch (error) {
    toast.error(t("auth.user_update_failed"));
  } finally {
    loading.value = false;
  }
};

watch(() => props.user, resetForm, { immediate: true });
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      resetForm();
    }
  },
);
</script>
