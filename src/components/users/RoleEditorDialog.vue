<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="flex max-h-[90vh] flex-col p-0 sm:max-w-[520px]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <DialogHeader class="px-6 pt-6">
        <DialogTitle>
          {{ role ? $t("auth.edit_role") : $t("auth.create_role") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("auth.admin_only_permissions") }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex-1 overflow-y-auto px-6">
        <form id="form-role-editor" @submit.prevent="save">
          <FieldGroup>
            <Field :data-invalid="nameInvalid">
              <FieldLabel :for="nameId">{{ $t("auth.role_name") }}</FieldLabel>
              <Input
                :id="nameId"
                v-model="name"
                :maxlength="ROLE_NAME_MAX_LENGTH"
                :aria-invalid="nameInvalid"
                autocomplete="off"
                data-testid="role-name"
              />
              <FieldError
                v-if="nameInvalid"
                :errors="[$t('auth.field_required')]"
              />
            </Field>

            <FieldSet v-if="!role" class="gap-3">
              <FieldLegend variant="label" class="mb-0">
                {{ $t("auth.role_template") }}
              </FieldLegend>
              <RadioGroup
                :model-value="templateId"
                class="flex flex-wrap gap-6"
                @update:model-value="(value) => applyTemplate(String(value))"
              >
                <Field
                  v-for="template in templates"
                  :key="template.role_id"
                  orientation="horizontal"
                  class="w-auto"
                >
                  <RadioGroupItem
                    :id="`${nameId}-${template.role_id}`"
                    :value="template.role_id"
                    :data-template="template.role_id"
                  />
                  <FieldLabel
                    :for="`${nameId}-${template.role_id}`"
                    class="font-normal"
                  >
                    {{ roleDisplayName(template.role_id, store.roles) }}
                  </FieldLabel>
                </Field>
              </RadioGroup>
            </FieldSet>

            <FieldSeparator />

            <RolePermissionList :scopes="scopes" @toggle="toggle" />
          </FieldGroup>
        </form>
      </div>
      <DialogFooter class="border-t px-6 pt-4 pb-6">
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="form-role-editor"
          :disabled="saving"
          :loading="saving"
        >
          {{ role ? $t("settings.save") : $t("create") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import RolePermissionList from "@/components/users/RolePermissionList.vue";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import {
  customRoleScopes,
  ROLE_NAME_MAX_LENGTH,
  ROLE_TEMPLATE_IDS,
  roleDisplayName,
  roleTemplateScopes,
  sameScopes,
  toggleScope,
} from "@/helpers/roles";
import { api, ApiCommandError } from "@/plugins/api";
import { type Role, UserRole } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, ref, useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  // the custom role to edit, null to create a new one
  role: Role | null;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  saved: [];
}>();

const { t } = useI18n();
const nameId = useId();

const name = ref("");
const templateId = ref<string>(UserRole.GUEST);
const scopes = ref<string[]>([]);
// an empty name is only flagged once saving was tried
const submitted = ref(false);
const saving = ref(false);

const trimmedName = computed(() => name.value.trim());
const nameInvalid = computed(() => submitted.value && !trimmedName.value);

const templates = computed(() =>
  ROLE_TEMPLATE_IDS.flatMap((roleId) =>
    store.roles.filter((role) => role.role_id === roleId),
  ),
);

const applyTemplate = (roleId: string) => {
  templateId.value = roleId;
  const template = store.roles.find((role) => role.role_id === roleId);
  scopes.value = template ? roleTemplateScopes(template) : customRoleScopes([]);
};

const toggle = (scope: string, enabled: boolean) => {
  scopes.value = toggleScope(scopes.value, scope, enabled);
};

const save = async () => {
  submitted.value = true;
  if (!trimmedName.value) return;
  saving.value = true;
  try {
    if (props.role) {
      await saveChanges(props.role);
    } else {
      await api.createRole(trimmedName.value, scopes.value);
      toast.success(t("auth.role_created"));
    }
    emit("saved");
    emit("update:open", false);
  } catch (error) {
    toast.error(
      error instanceof ApiCommandError && error.details
        ? error.details
        : t(props.role ? "auth.role_update_failed" : "auth.role_create_failed"),
    );
  } finally {
    saving.value = false;
  }
};

const saveChanges = async (role: Role) => {
  const updates: { name?: string; scopes?: string[] } = {};
  if (trimmedName.value !== role.name) updates.name = trimmedName.value;
  if (!sameScopes(scopes.value, role.scopes)) updates.scopes = scopes.value;
  if (Object.keys(updates).length === 0) return;
  await api.updateRole(role.role_id, updates);
  toast.success(t("auth.role_updated"));
};

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    submitted.value = false;
    name.value = props.role?.name ?? "";
    if (props.role) scopes.value = customRoleScopes(props.role.scopes);
    else applyTemplate(UserRole.GUEST);
  },
  { immediate: true },
);
</script>
