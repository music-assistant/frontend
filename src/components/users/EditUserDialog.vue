<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0">
      <DialogHeader class="px-6 pt-6 pb-4">
        <DialogTitle>{{ $t("auth.edit_user") }}</DialogTitle>
      </DialogHeader>
      <div ref="scrollContainer" class="flex-1 overflow-y-auto px-6">
        <form id="form-edit-user" @submit.prevent="handleFormSubmit">
          <FieldGroup>
            <form.Field name="username">
              <template #default="{ field }">
                <Field :data-invalid="isInvalid(field)">
                  <FieldLabel :for="field.name">
                    {{ $t("auth.username") }}
                  </FieldLabel>
                  <Input
                    :id="field.name"
                    :name="field.name"
                    :model-value="field.state.value"
                    :aria-invalid="isInvalid(field)"
                    autocomplete="username"
                    @blur="field.handleBlur"
                    @input="
                      (e: Event) => {
                        field.handleChange(
                          (e.target as HTMLInputElement).value,
                        );
                      }
                    "
                  />
                  <FieldError
                    v-if="isInvalid(field)"
                    :errors="field.state.meta.errors"
                  />
                </Field>
              </template>
            </form.Field>

            <form.Field name="displayName">
              <template #default="{ field }">
                <Field>
                  <FieldLabel :for="field.name">
                    {{ $t("auth.display_name") }}
                  </FieldLabel>
                  <Input
                    :id="field.name"
                    :name="field.name"
                    :model-value="field.state.value"
                    autocomplete="name"
                    @blur="field.handleBlur"
                    @input="
                      (e: Event) => {
                        field.handleChange(
                          (e.target as HTMLInputElement).value,
                        );
                      }
                    "
                  />
                  <FieldDescription>
                    {{ $t("optional") }}
                  </FieldDescription>
                </Field>
              </template>
            </form.Field>

            <form.Field name="avatarUrl">
              <template #default="{ field }">
                <Field :data-invalid="isInvalid(field)">
                  <FieldLabel :for="field.name">
                    {{ $t("auth.avatar_url") }}
                  </FieldLabel>
                  <Input
                    :id="field.name"
                    :name="field.name"
                    :model-value="field.state.value"
                    :aria-invalid="isInvalid(field)"
                    @blur="field.handleBlur"
                    @input="
                      (e: Event) => {
                        field.handleChange(
                          (e.target as HTMLInputElement).value,
                        );
                      }
                    "
                  />
                  <FieldDescription>
                    {{ $t("auth.avatar_url_hint") }}
                  </FieldDescription>
                  <FieldError
                    v-if="isInvalid(field)"
                    :errors="field.state.meta.errors"
                  />
                </Field>
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
                    :disabled="isCurrentUser"
                    @update:model-value="
                      (value) => field.handleChange(value as any)
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
                <Field :data-invalid="isInvalid(field)">
                  <FieldLabel :for="field.name">
                    {{ $t("auth.new_password") }}
                  </FieldLabel>
                  <Input
                    :id="field.name"
                    :name="field.name"
                    type="password"
                    :model-value="field.state.value"
                    :aria-invalid="isInvalid(field)"
                    autocomplete="new-password"
                    @blur="field.handleBlur"
                    @input="
                      (e: Event) => {
                        field.handleChange(
                          (e.target as HTMLInputElement).value,
                        );
                      }
                    "
                  />
                  <FieldDescription>
                    {{ $t("auth.password_optional_hint") }}
                  </FieldDescription>
                  <FieldError
                    v-if="isInvalid(field)"
                    :errors="field.state.meta.errors"
                  />
                </Field>
              </template>
            </form.Field>

            <form.Field
              v-if="form.state.values.password"
              name="confirmPassword"
            >
              <template #default="{ field }">
                <Field :data-invalid="isInvalid(field)">
                  <FieldLabel :for="field.name">
                    {{ $t("auth.confirm_password") }}
                  </FieldLabel>
                  <Input
                    :id="field.name"
                    :name="field.name"
                    type="password"
                    :model-value="field.state.value"
                    :aria-invalid="isInvalid(field)"
                    autocomplete="new-password"
                    @blur="field.handleBlur"
                    @input="
                      (e: Event) => {
                        field.handleChange(
                          (e.target as HTMLInputElement).value,
                        );
                      }
                    "
                  />
                  <FieldError
                    v-if="isInvalid(field)"
                    :errors="field.state.meta.errors"
                  />
                </Field>
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

            <form.Field name="providerFilter">
              <template #default="{ field }">
                <Field>
                  <FieldLabel>
                    {{ $t("auth.provider_filter") }}
                  </FieldLabel>
                  <MultiSelect
                    :model-value="field.state.value"
                    :options="providerOptions"
                    :placeholder="$t('auth.select_providers')"
                    @update:model-value="field.handleChange"
                  />
                  <FieldDescription>
                    {{ $t("auth.provider_filter_hint") }}
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
        <Button
          type="submit"
          form="form-edit-user"
          :disabled="loading"
          :loading="loading"
        >
          {{ $t("edit") }}
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
import { toast } from "vuetify-sonner";

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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { editUserSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";
import type { User } from "@/plugins/api/interfaces";
import { ProviderType, UserRole } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import MultiSelect from "./MultiSelect.vue";

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

const isInvalid = (field: any) => {
  return field.state.meta.errors.length > 0;
};

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
