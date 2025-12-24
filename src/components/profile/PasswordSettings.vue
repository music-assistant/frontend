<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("auth.change_password") }}</CardTitle>
      <CardDescription>
        {{ $t("auth.update_your_password") }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div
        v-if="store.isIngressSession"
        class="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-600 dark:text-blue-400"
      >
        {{ $t("auth.ingress_password_note") }}
      </div>

      <form id="form-password-settings" @submit.prevent="form.handleSubmit">
        <FieldGroup>
          <form.Field name="newPassword">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">
                  {{ $t("auth.new_password") }}
                </FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  :model-value="field.state.value"
                  type="password"
                  :aria-invalid="isInvalid(field)"
                  autocomplete="new-password"
                  @blur="field.handleBlur"
                  @input="handleNewPasswordInput($event, field)"
                />
                <FieldError
                  v-if="isInvalid(field)"
                  :errors="field.state.meta.errors"
                />
              </Field>
            </template>
          </form.Field>

          <form.Field name="confirmPassword">
            <template #default="{ field }">
              <Field :data-invalid="isInvalid(field)">
                <FieldLabel :for="field.name">
                  {{ $t("auth.confirm_password") }}
                </FieldLabel>
                <Input
                  :id="field.name"
                  :name="field.name"
                  :model-value="field.state.value"
                  type="password"
                  :aria-invalid="isInvalid(field)"
                  autocomplete="new-password"
                  @blur="field.handleBlur"
                  @input="handleConfirmPasswordInput($event, field)"
                />
                <FieldError
                  v-if="isInvalid(field)"
                  :errors="field.state.meta.errors"
                />
              </Field>
            </template>
          </form.Field>
        </FieldGroup>
      </form>
    </CardContent>
    <CardFooter>
      <Button
        type="submit"
        form="form-password-settings"
        :disabled="!canChangePassword || changing"
        :loading="changing"
      >
        {{ $t("auth.update_password") || "Update password" }}
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

function isInvalid(field: any) {
  return field.state.meta.isTouched && !field.state.meta.isValid;
}

const handleNewPasswordInput = (e: Event, field: any) => {
  const value = (e.target as HTMLInputElement).value;
  currentNewPassword.value = value;
  field.handleChange(value);
};

const handleConfirmPasswordInput = (e: Event, field: any) => {
  const value = (e.target as HTMLInputElement).value;
  currentConfirmPassword.value = value;
  field.handleChange(value);
};
</script>
