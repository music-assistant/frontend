<template>
  <div class="flex flex-col gap-6">
    <FieldSet class="gap-3">
      <FieldLegend variant="label" class="mb-0">
        {{ $t("auth.permissions.always") }}
      </FieldLegend>
      <ul class="flex flex-col gap-3 text-sm">
        <li
          v-for="key in ALWAYS_ALLOWED_PERMISSION_KEYS"
          :key="key"
          class="flex items-center justify-between gap-4"
        >
          {{ $t(key) }}
          <Check class="text-primary size-4 shrink-0" aria-hidden="true" />
        </li>
      </ul>
    </FieldSet>

    <FieldSet
      v-for="group in ROLE_PERMISSION_GROUPS"
      :key="group.titleKey"
      class="gap-3"
    >
      <FieldLegend variant="label" class="mb-0">
        {{ $t(group.titleKey) }}
      </FieldLegend>
      <Field
        v-for="permission in group.permissions"
        :key="permission.scope"
        orientation="horizontal"
      >
        <FieldLabel :for="switchId(permission.scope)" class="font-normal">
          {{ $t(permission.labelKey) }}
        </FieldLabel>
        <Switch
          :id="switchId(permission.scope)"
          :model-value="scopes.includes(permission.scope)"
          :disabled="readonly || isImpliedScope(scopes, permission.scope)"
          :data-scope="permission.scope"
          @update:model-value="
            (enabled: boolean) => emit('toggle', permission.scope, enabled)
          "
        />
      </Field>
    </FieldSet>
  </div>
</template>

<script setup lang="ts">
import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  ALWAYS_ALLOWED_PERMISSION_KEYS,
  isImpliedScope,
  ROLE_PERMISSION_GROUPS,
} from "@/helpers/roles";
import { Check } from "@lucide/vue";
import { useId } from "vue";

defineProps<{
  // every scope the role holds
  scopes: readonly string[];
  // show what the role may do without letting it be changed
  readonly?: boolean;
}>();

const emit = defineEmits<{
  toggle: [scope: string, enabled: boolean];
}>();

const idPrefix = useId();

const switchId = (scope: string) => `${idPrefix}-${scope.replaceAll(".", "-")}`;
</script>
