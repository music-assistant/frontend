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
                <Field :data-invalid="isInvalid(field)">
                  <FieldLabel :for="field.name">
                    {{ $t("auth.username") }}
                  </FieldLabel>
                  <Input
                    :id="field.name"
                    :name="field.name"
                    :model-value="field.state.value"
                    :aria-invalid="isInvalid(field)"
                    autofocus
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

            <form.Field name="password">
              <template #default="{ field }">
                <Field :data-invalid="isInvalid(field)">
                  <FieldLabel :for="field.name">
                    {{ $t("auth.password") }}
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

            <form.Field name="confirmPassword">
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

            <form.Field name="role">
              <template #default="{ field }">
                <Field>
                  <FieldLabel :for="field.name">
                    {{ $t("auth.role") }}
                  </FieldLabel>
                  <Select
                    :model-value="field.state.value"
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
          form="form-create-user"
          :disabled="loading"
          :loading="loading"
        >
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
import { createUserSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";
import { ProviderType, UserRole } from "@/plugins/api/interfaces";
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

const isInvalid = (field: any) => {
  return field.state.meta.errors.length > 0;
};

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
