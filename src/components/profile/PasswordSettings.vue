<template>
  <v-card>
    <v-card-title>{{ $t("auth.change_password") }}</v-card-title>
    <v-card-subtitle>
      {{ $t("auth.update_your_password") }}
    </v-card-subtitle>
    <v-card-text>
      <v-alert
        v-if="store.isIngressSession"
        type="info"
        variant="tonal"
        class="mb-4"
        density="compact"
      >
        {{ $t("auth.ingress_password_note") }}
      </v-alert>

      <form id="form-password-settings" @submit.prevent="form.handleSubmit">
        <form.Field name="newPassword">
          <template #default="{ field }">
            <v-text-field
              :id="field.name"
              :name="field.name"
              :model-value="field.state.value"
              :label="$t('auth.new_password')"
              type="password"
              :error-messages="field.state.meta.errors"
              autocomplete="new-password"
              variant="outlined"
              class="mb-2"
              @blur="field.handleBlur"
              @input="
                (e: any) => {
                  handleNewPasswordInput(e, field);
                  field.handleChange(e.target.value);
                }
              "
            />
          </template>
        </form.Field>

        <form.Field name="confirmPassword">
          <template #default="{ field }">
            <v-text-field
              :id="field.name"
              :name="field.name"
              :model-value="field.state.value"
              :label="$t('auth.confirm_password')"
              type="password"
              :error-messages="field.state.meta.errors"
              autocomplete="new-password"
              variant="outlined"
              class="mb-2"
              @blur="field.handleBlur"
              @input="
                (e: any) => {
                  handleConfirmPasswordInput(e, field);
                  field.handleChange(e.target.value);
                }
              "
            />
          </template>
        </form.Field>
      </form>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        type="submit"
        form="form-password-settings"
        color="primary"
        :disabled="!canChangePassword || changing"
        :loading="changing"
      >
        {{ $t("auth.update_password") || "Update password" }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

import { createPasswordSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";
import { store } from "@/plugins/store";

const { t } = useI18n();

const changing = ref(false);

const currentNewPassword = ref("");
const currentConfirmPassword = ref("");

const form = useForm({
  defaultValues: {
    newPassword: "",
    confirmPassword: "",
  },
  validators: {
    onSubmit: createPasswordSchema(t),
  },
  onSubmit: async ({ value }) => {
    changing.value = true;

    try {
      const result = await api.changePassword(value.newPassword);

      if (result) {
        toast.success(t("auth.password_changed"));
        form.reset();
        currentNewPassword.value = "";
        currentConfirmPassword.value = "";
      } else {
        toast.error(t("auth.password_change_failed"));
      }
    } catch (err: any) {
      toast.error(err.message || t("auth.password_change_failed"));
    } finally {
      changing.value = false;
    }
  },
});

const canChangePassword = computed(() => {
  const newPassword =
    currentNewPassword.value || form.state.values.newPassword || "";
  const confirmPassword =
    currentConfirmPassword.value || form.state.values.confirmPassword || "";
  return newPassword === confirmPassword && confirmPassword.length > 0;
});

const handleNewPasswordInput = (e: Event, field: any) => {
  const value = (e.target as HTMLInputElement).value;
  currentNewPassword.value = value;
};

const handleConfirmPasswordInput = (e: Event, field: any) => {
  const value = (e.target as HTMLInputElement).value;
  currentConfirmPassword.value = value;
};
</script>
