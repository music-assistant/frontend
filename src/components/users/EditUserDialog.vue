<template>
  <v-dialog v-model="isOpen" max-width="600" scrollable>
    <v-card>
      <v-card-title class="px-4 pt-4">
        {{ $t("auth.edit_user") }}
      </v-card-title>

      <v-card-text class="px-4 py-2" style="max-height: 70vh; overflow-y: auto">
        <form id="form-edit-user" @submit.prevent="handleFormSubmit">
          <form.Field name="username">
            <template #default="{ field }">
              <v-text-field
                :id="field.name"
                :name="field.name"
                :model-value="field.state.value"
                :label="$t('auth.username')"
                :error-messages="field.state.meta.errors"
                variant="outlined"
                autocomplete="username"
                class="mb-2"
                @blur="field.handleBlur"
                @update:model-value="field.handleChange"
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
                variant="outlined"
                autocomplete="name"
                class="mb-2"
                @blur="field.handleBlur"
                @update:model-value="field.handleChange"
              />
            </template>
          </form.Field>

          <form.Field name="avatarUrl">
            <template #default="{ field }">
              <v-text-field
                :id="field.name"
                :name="field.name"
                :model-value="field.state.value"
                :label="$t('auth.avatar_url')"
                :hint="$t('auth.avatar_url_hint')"
                :error-messages="field.state.meta.errors"
                persistent-hint
                variant="outlined"
                class="mb-2"
                @blur="field.handleBlur"
                @update:model-value="field.handleChange"
              />
            </template>
          </form.Field>

          <form.Field name="role">
            <template #default="{ field }">
              <v-select
                :id="field.name"
                :model-value="field.state.value"
                :items="roleOptions"
                item-title="label"
                item-value="value"
                :label="$t('auth.role')"
                :disabled="isCurrentUser"
                variant="outlined"
                class="mb-2"
                @update:model-value="field.handleChange"
              />
            </template>
          </form.Field>

          <form.Field name="password">
            <template #default="{ field }">
              <v-text-field
                :id="field.name"
                :name="field.name"
                type="password"
                :model-value="field.state.value"
                :label="$t('auth.new_password')"
                :hint="$t('auth.password_optional_hint')"
                :error-messages="field.state.meta.errors"
                persistent-hint
                variant="outlined"
                autocomplete="new-password"
                class="mb-2"
                @blur="field.handleBlur"
                @update:model-value="field.handleChange"
              />
            </template>
          </form.Field>

          <form.Field v-if="form.state.values.password" name="confirmPassword">
            <template #default="{ field }">
              <v-text-field
                :id="field.name"
                :name="field.name"
                type="password"
                :model-value="field.state.value"
                :label="$t('auth.confirm_password')"
                :error-messages="field.state.meta.errors"
                variant="outlined"
                autocomplete="new-password"
                class="mb-2"
                @blur="field.handleBlur"
                @update:model-value="field.handleChange"
              />
            </template>
          </form.Field>

          <form.Field name="playerFilter">
            <template #default="{ field }">
              <v-select
                :model-value="field.state.value"
                :items="playerOptions"
                item-title="label"
                item-value="value"
                :label="$t('auth.player_filter')"
                :hint="$t('auth.player_filter_hint')"
                persistent-hint
                multiple
                chips
                closable-chips
                variant="outlined"
                class="mb-2"
                @update:model-value="field.handleChange"
              />
            </template>
          </form.Field>

          <form.Field name="providerFilter">
            <template #default="{ field }">
              <v-select
                :model-value="field.state.value"
                :items="providerOptions"
                item-title="label"
                item-value="value"
                :label="$t('auth.provider_filter')"
                :hint="$t('auth.provider_filter_hint')"
                persistent-hint
                multiple
                chips
                closable-chips
                variant="outlined"
                class="mb-2"
                @update:model-value="field.handleChange"
              />
            </template>
          </form.Field>
        </form>
      </v-card-text>

      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" @click="handleClose">
          {{ $t("cancel") }}
        </v-btn>
        <v-btn
          color="primary"
          type="submit"
          form="form-edit-user"
          :loading="loading"
          :disabled="loading"
        >
          {{ $t("edit") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { useVModel } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

import { editUserSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";
import type { User } from "@/plugins/api/interfaces";
import { ProviderType, UserRole } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  user: User | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  updated: [];
}>();

const isOpen = useVModel(props, "modelValue", emit);

const loading = ref(false);

const handleFormSubmit = async () => {
  await form.handleSubmit();
};

const roleOptions = computed(() => [
  { label: t("auth.admin_role"), value: "admin" },
  { label: t("auth.user_role"), value: "user" },
]);

const playerOptions = computed(() => {
  return Object.values(api.players)
    .map((player) => ({
      label: player.name,
      value: player.player_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const providerOptions = computed(() => {
  return Object.values(api.providers)
    .filter((provider) => provider.type === ProviderType.MUSIC)
    .map((provider) => ({
      label: provider.name,
      value: provider.instance_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const isCurrentUser = computed(() => {
  if (!props.user || !store.currentUser) return false;
  return props.user.user_id === store.currentUser.user_id;
});

const form = useForm({
  defaultValues: {
    username: props.user?.username || "",
    displayName: props.user?.display_name || "",
    avatarUrl: props.user?.avatar_url || "",
    role: props.user?.role || ("user" as UserRole),
    password: "",
    confirmPassword: "",
    playerFilter: props.user?.player_filter || [],
    providerFilter: props.user?.provider_filter || [],
  },
  validators: {
    onSubmit: editUserSchema(t) as any,
  },
  onSubmit: async ({ value }) => {
    if (!props.user) return;

    loading.value = true;

    try {
      const updates: {
        username?: string;
        displayName?: string;
        avatarUrl?: string;
        role?: UserRole;
        password?: string;
        player_filter?: string[];
        provider_filter?: string[];
      } = {};

      if (value.username !== props.user.username) {
        updates.username = value.username;
      }
      if (value.displayName !== (props.user.display_name || "")) {
        updates.displayName = value.displayName;
      }
      if (value.avatarUrl !== (props.user.avatar_url || "")) {
        updates.avatarUrl = value.avatarUrl;
      }
      if (value.role !== props.user.role && !isCurrentUser.value) {
        updates.role = value.role;
      }
      if (value.password) {
        updates.password = value.password;
      }

      const currentPlayerFilter = props.user.player_filter || [];
      if (
        JSON.stringify([...value.playerFilter].sort()) !==
        JSON.stringify([...currentPlayerFilter].sort())
      ) {
        updates.player_filter = value.playerFilter;
      }

      const currentProviderFilter = props.user.provider_filter || [];
      if (
        JSON.stringify([...value.providerFilter].sort()) !==
        JSON.stringify([...currentProviderFilter].sort())
      ) {
        updates.provider_filter = value.providerFilter;
      }

      await api.updateUser(props.user.user_id, updates);
      toast.success(t("auth.user_updated"));
      emit("updated");
      emit("update:modelValue", false);
    } catch (error) {
      toast.error(t("auth.user_update_failed"));
    } finally {
      loading.value = false;
    }
  },
});

const resetForm = () => {
  if (props.user) {
    form.setFieldValue("username", props.user.username);
    form.setFieldValue("displayName", props.user.display_name || "");
    form.setFieldValue("avatarUrl", props.user.avatar_url || "");
    form.setFieldValue("role", props.user.role);
    form.setFieldValue("password", "");
    form.setFieldValue("confirmPassword", "");
    form.setFieldValue("playerFilter", props.user.player_filter || []);
    form.setFieldValue("providerFilter", props.user.provider_filter || []);
  }
};

const handleClose = () => {
  resetForm();
  emit("update:modelValue", false);
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
