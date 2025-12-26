<template>
  <v-dialog v-model="isOpen" max-width="600" scrollable>
    <v-card>
      <v-card-title class="px-4 pt-4">
        {{ $t("auth.create_user") }}
      </v-card-title>
      
      <v-card-text class="px-4 py-2" style="max-height: 70vh; overflow-y: auto">
        <form id="form-create-user" @submit.prevent="handleFormSubmit">
          <form.Field name="username">
            <template #default="{ field }">
              <v-text-field
                :id="field.name"
                :name="field.name"
                :model-value="field.state.value"
                :label="$t('auth.username')"
                :error-messages="field.state.meta.errors"
                variant="outlined"
                autofocus
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

          <form.Field name="password">
            <template #default="{ field }">
              <v-text-field
                :id="field.name"
                :name="field.name"
                type="password"
                :model-value="field.state.value"
                :label="$t('auth.password')"
                :error-messages="field.state.meta.errors"
                variant="outlined"
                autocomplete="new-password"
                class="mb-2"
                @blur="field.handleBlur"
                @update:model-value="field.handleChange"
              />
            </template>
          </form.Field>

          <form.Field name="confirmPassword">
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

          <form.Field name="role">
            <template #default="{ field }">
              <v-select
                :id="field.name"
                :model-value="field.state.value"
                :items="roleOptions"
                item-title="label"
                item-value="value"
                :label="$t('auth.role')"
                variant="outlined"
                class="mb-2"
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
          form="form-create-user"
          :loading="loading"
          :disabled="loading"
        >
          {{ $t("create") }}
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

import { createUserSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";
import { ProviderType, UserRole } from "@/plugins/api/interfaces";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  created: [];
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

const form = useForm({
  defaultValues: {
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
    role: "user" as UserRole,
    playerFilter: [] as string[],
    providerFilter: [] as string[],
  },
  validators: {
    onSubmit: createUserSchema(t) as any,
  },
  onSubmit: async ({ value }) => {
    loading.value = true;

    try {
      const user = await api.createUser(
        value.username,
        value.password,
        value.role,
        value.displayName || undefined,
        value.playerFilter.length > 0 ? value.playerFilter : undefined,
        value.providerFilter.length > 0 ? value.providerFilter : undefined,
      );

      if (user) {
        toast.success(t("auth.user_created"));
        form.reset();
        emit("created");
        emit("update:modelValue", false);
      } else {
        toast.error(t("auth.user_create_failed"));
      }
    } catch (error) {
      toast.error(t("auth.user_create_failed"));
    } finally {
      loading.value = false;
    }
  },
});

const handleClose = () => {
  form.reset();
  emit("update:modelValue", false);
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (!newVal) {
      form.reset();
    }
  },
);
</script>
