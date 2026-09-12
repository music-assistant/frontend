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
        <FieldContent>
          <FieldLabel :for="switchId(permission.scope)" class="font-normal">
            {{ $t(permission.labelKey) }}
          </FieldLabel>
          <FieldDescription v-if="!readonly && neededKey(permission.scope)">
            {{
              $t("auth.permissions.needed_for", {
                permission: $t(neededKey(permission.scope) ?? ""),
              })
            }}
          </FieldDescription>
        </FieldContent>
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

    <FieldSet v-if="readonly && extras.length > 0" class="gap-3">
      <FieldLegend variant="label" class="mb-0">
        {{ $t("auth.permissions.also") }}
      </FieldLegend>
      <ul class="flex flex-col gap-3 text-sm">
        <li
          v-for="extra in extras"
          :key="extra.scope"
          class="flex items-center justify-between gap-4"
        >
          {{ extra.labelKey ? $t(extra.labelKey) : extra.scope }}
          <Check class="text-primary size-4 shrink-0" aria-hidden="true" />
        </li>
      </ul>
    </FieldSet>
  </div>
</template>

<script setup lang="ts">
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  ALWAYS_ALLOWED_PERMISSION_KEYS,
  extraPermissions,
  isImpliedScope,
  neededByLabelKey,
  ROLE_PERMISSION_GROUPS,
} from "@/helpers/roles";
import { Check } from "@lucide/vue";
import { computed, useId } from "vue";

const props = defineProps<{
  // every scope the role holds
  scopes: readonly string[];
  // show what the role may do without letting it be changed
  readonly?: boolean;
}>();

const emit = defineEmits<{
  toggle: [scope: string, enabled: boolean];
}>();

const idPrefix = useId();

// what a builtin role may do beyond the permissions a custom role can get
const extras = computed(() => extraPermissions(props.scopes));

// the permission that keeps a locked scope on
const neededKey = (scope: string) => neededByLabelKey(props.scopes, scope);

const switchId = (scope: string) => `${idPrefix}-${scope.replaceAll(".", "-")}`;
</script>
