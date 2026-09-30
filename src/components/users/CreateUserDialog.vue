<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-h-[70vh] flex flex-col p-0">
      <DialogHeader class="px-6 pt-6 pb-4">
        <DialogTitle>{{ $t("auth.create_user") }}</DialogTitle>
      </DialogHeader>
      <div ref="scrollContainer" class="flex-1 overflow-y-auto px-6">
        <form id="form-create-user" @submit.prevent="handleFormSubmit">
          <FieldGroup>
            <form.Field name="username">
              <template #default="{ field }">
                <FormTextField
                  :field="field"
                  :label="$t('auth.username')"
                  autofocus
                  autocomplete="username"
                />
              </template>
            </form.Field>

            <form.Field name="displayName">
              <template #default="{ field }">
                <FormTextField
                  :field="field"
                  :label="$t('auth.display_name')"
                  autocomplete="name"
                  :description="$t('optional')"
                  :show-validation="false"
                />
              </template>
            </form.Field>

            <form.Field name="role">
              <template #default="{ field }">
                <Field>
                  <FieldLabel :for="field.name">
                    {{ $t("auth.role") }}
                  </FieldLabel>
                  <Select
                    :model-value="field.state.value"
                    @update:model-value="
                      (value) => field.handleChange(value as string)
                    "
                  >
                    <SelectTrigger :id="field.name" class="w-full">
                      <SelectValue :placeholder="$t('auth.role')" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in roleOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </template>
            </form.Field>

            <form.Field name="password">
              <template #default="{ field }">
                <FormTextField
                  :field="field"
                  :label="$t('auth.password')"
                  type="password"
                  autocomplete="new-password"
                />
              </template>
            </form.Field>

            <form.Field name="confirmPassword">
              <template #default="{ field }">
                <FormTextField
                  :field="field"
                  :label="$t('auth.confirm_password')"
                  type="password"
                  autocomplete="new-password"
                />
              </template>
            </form.Field>

            <form.Field name="playerFilter">
              <template #default="{ field }">
                <Field>
                  <FieldLabel>
                    {{ $t("auth.player_filter") }}
                  </FieldLabel>
                  <MultiSelect
                    :model-value="field.state.value"
                    :options="playerOptions"
                    :placeholder="$t('auth.select_players')"
                    @update:model-value="field.handleChange"
                  />
                  <FieldDescription>
                    {{ $t("auth.player_filter_hint") }}
                  </FieldDescription>
                </Field>
              </template>
            </form.Field>
          </FieldGroup>
        </form>
      </div>
      <DialogFooter class="px-6 pb-6 pt-4 border-t shrink-0">
        <Button variant="outline" @click="handleClose">
          {{ $t("cancel") }}
        </Button>
        <Button type="submit" form="form-create-user" :loading="loading">
          {{ $t("create") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { useVModel } from "@vueuse/core";
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

import FormTextField from "@/components/forms/FormTextField.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignableRoles, roleDisplayName } from "@/helpers/roles";
import { createUserSchema } from "@/lib/forms/profile";
import { api, ApiCommandError } from "@/plugins/api";
import { UserRole } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import MultiSelect from "./MultiSelect.vue";

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
const scrollContainer = ref<HTMLElement | null>(null);

const scrollToFirstError = async () => {
  await nextTick();
  if (!scrollContainer.value) return;

  const firstErrorInput = scrollContainer.value.querySelector(
    "[aria-invalid='true'], [data-invalid='true']",
  ) as HTMLElement;

  if (firstErrorInput) {
    firstErrorInput.scrollIntoView({ behavior: "smooth", block: "center" });
    firstErrorInput.focus();
  }
};

const handleFormSubmit = async () => {
  await form.handleSubmit();
  await nextTick();

  if (scrollContainer.value) {
    const hasErrors = scrollContainer.value.querySelector(
      "[aria-invalid='true'], [data-invalid='true']",
    );
    if (hasErrors) {
      await scrollToFirstError();
    }
  }
};

const roleOptions = computed(() =>
  assignableRoles(store.roles).map((role) => ({
    label: roleDisplayName(role.role_id, store.roles),
    value: role.role_id,
  })),
);

const playerOptions = computed(() => {
  return Object.values(api.players)
    .map((player) => ({
      label: player.name,
      value: player.player_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

const form = useForm({
  defaultValues: {
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
    role: UserRole.USER as string,
    playerFilter: [] as string[],
  },
  validators: {
    onSubmit: createUserSchema(t),
  },
  onSubmit: async ({ value }) => {
    loading.value = true;

    try {
      await api.createUser(
        value.username,
        value.password,
        value.role,
        value.displayName || undefined,
        value.playerFilter.length > 0 ? value.playerFilter : undefined,
        { suppressGlobalError: true },
      );

      toast.success(t("auth.user_created"));
      form.reset();
      emit("created");
      emit("update:modelValue", false);
    } catch (error) {
      toast.error(
        error instanceof ApiCommandError && error.details
          ? error.details
          : t("auth.user_create_failed"),
      );
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
