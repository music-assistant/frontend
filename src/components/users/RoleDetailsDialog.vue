<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[90vh] flex-col p-0 sm:max-w-[520px]">
      <DialogHeader class="px-6 pt-6">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          {{ $t(descriptionKey) }}
        </DialogDescription>
      </DialogHeader>
      <div v-if="role && !grantsEverything" class="flex-1 overflow-y-auto px-6">
        <RolePermissionList :scopes="role.scopes" readonly />
      </div>
      <DialogFooter class="border-t px-6 pt-4 pb-6">
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t("close") }}
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
import RolePermissionList from "@/components/users/RolePermissionList.vue";
import { roleDisplayName } from "@/helpers/roles";
import { type Role, Scope } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed } from "vue";

const props = defineProps<{
  open: boolean;
  // the role to show
  role: Role | null;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const title = computed(() =>
  props.role ? roleDisplayName(props.role.role_id, store.roles) : "",
);

// the admin role holds the scope that grants every other one
const grantsEverything = computed(
  () => props.role?.scopes.includes(Scope.ALL) ?? false,
);

// a custom role only opens here for a user who may not change it
const descriptionKey = computed(() => {
  if (grantsEverything.value) return "auth.admin_role_permissions";
  return props.role?.builtin === false
    ? "auth.custom_role_readonly_hint"
    : "auth.builtin_role_hint";
});
</script>
