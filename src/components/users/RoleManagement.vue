<template>
  <div class="space-y-6">
    <div v-if="canManageRoles" class="flex justify-end">
      <Button data-testid="create-role" @click="openEditor(null)">
        <Plus :size="16" />
        {{ $t("auth.create_role") }}
      </Button>
    </div>

    <section class="space-y-3">
      <h2 class="text-muted-foreground text-sm font-medium">
        {{ $t("auth.builtin_roles") }}
      </h2>
      <ItemGroup class="gap-2">
        <Item
          v-for="role in builtinRoles"
          :key="role.role_id"
          variant="outline"
          class="cursor-pointer"
          data-testid="builtin-role"
          @click="viewRole(role)"
        >
          <ItemMedia variant="icon">
            <component :is="roleIcon(role)" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              <!-- the name is the focusable control; the row itself only follows the pointer -->
              <button
                type="button"
                class="cursor-pointer text-left"
                @click.stop="viewRole(role)"
              >
                {{ roleDisplayName(role.role_id, store.roles) }}
              </button>
            </ItemTitle>
            <ItemDescription>{{ usersLabel(role) }}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <ChevronRight class="text-muted-foreground size-4" />
          </ItemActions>
        </Item>
      </ItemGroup>
    </section>

    <section class="space-y-3">
      <h2 class="text-muted-foreground text-sm font-medium">
        {{ $t("auth.custom_roles") }}
      </h2>
      <ItemGroup v-if="customRoles.length > 0" class="gap-2">
        <Item
          v-for="role in customRoles"
          :key="role.role_id"
          variant="outline"
          class="cursor-pointer"
          data-testid="custom-role"
          @click="openRole(role)"
        >
          <ItemMedia variant="icon">
            <UserCog />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              <button
                type="button"
                class="cursor-pointer text-left"
                @click.stop="openRole(role)"
              >
                {{ role.name }}
              </button>
            </ItemTitle>
            <ItemDescription>{{ usersLabel(role) }}</ItemDescription>
          </ItemContent>
          <!-- a click on a disabled button passes through, and must not open the role -->
          <ItemActions v-if="canManageRoles" @click.stop>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="`${$t('auth.edit_role')}: ${role.name}`"
              :title="`${$t('auth.edit_role')}: ${role.name}`"
              @click="openEditor(role)"
            >
              <Pencil />
            </Button>
            <!-- the server refuses to delete a role that a user still holds -->
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-destructive hover:text-destructive"
              :disabled="userCount(role) > 0"
              :aria-label="`${$t('auth.delete_role')}: ${role.name}`"
              :title="`${$t('auth.delete_role')}: ${role.name}`"
              data-testid="delete-role"
              @click="confirmDelete(role)"
            >
              <Trash2 />
            </Button>
          </ItemActions>
          <ItemActions v-else>
            <ChevronRight class="text-muted-foreground size-4" />
          </ItemActions>
        </Item>
      </ItemGroup>
      <Empty v-else class="border" data-testid="no-custom-roles">
        <EmptyTitle>{{ $t("auth.no_custom_roles") }}</EmptyTitle>
        <EmptyDescription v-if="canManageRoles">
          {{ $t("auth.no_custom_roles_hint") }}
        </EmptyDescription>
      </Empty>
    </section>

    <RoleEditorDialog
      v-model:open="showEditor"
      :role="roleToEdit"
      @saved="refreshRoles"
    />
    <RoleDetailsDialog v-model:open="showDetails" :role="roleToView" />
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t("auth.delete_role") }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{
              $t("auth.confirm_delete_role", { name: roleToDelete?.name ?? "" })
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ $t("cancel") }}</AlertDialogCancel>
          <AlertDialogAction
            :class="buttonVariants({ variant: 'destructive' })"
            data-testid="confirm-delete-role"
            @click="deleteRole"
          >
            {{ $t("auth.delete_role") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import RoleDetailsDialog from "@/components/users/RoleDetailsDialog.vue";
import RoleEditorDialog from "@/components/users/RoleEditorDialog.vue";
import { loadRoles } from "@/composables/roles";
import { roleDisplayName } from "@/helpers/roles";
import { api, ApiCommandError } from "@/plugins/api";
import {
  type Role,
  Scope,
  type User,
  UserRole,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import {
  ChevronRight,
  Pencil,
  Plug,
  Plus,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  UserCog,
  UserRound,
} from "@lucide/vue";
import { type Component, computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const props = defineProps<{
  // every user, to count the users holding each role
  users: User[];
}>();

const { t } = useI18n();

const BUILTIN_ROLE_ICONS = new Map<string, Component>([
  [UserRole.ADMIN, ShieldCheck],
  [UserRole.USER, UserIcon],
  [UserRole.GUEST, UserRound],
  [UserRole.SERVICE, Plug],
]);

const showEditor = ref(false);
const showDetails = ref(false);
const showDeleteDialog = ref(false);
const roleToEdit = ref<Role | null>(null);
const roleToView = ref<Role | null>(null);
const roleToDelete = ref<Role | null>(null);

const builtinRoles = computed(() => store.roles.filter((role) => role.builtin));
const customRoles = computed(() => store.roles.filter((role) => !role.builtin));
// listing the roles takes no scope, changing them users.manage
const canManageRoles = computed(() => authManager.hasScope(Scope.USERS_MANAGE));

// a disabled user keeps its role, so it counts as well
const userCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const user of props.users) {
    counts.set(user.role, (counts.get(user.role) ?? 0) + 1);
  }
  return counts;
});

const userCount = (role: Role) => userCounts.value.get(role.role_id) ?? 0;

const usersLabel = (role: Role) => {
  const count = userCount(role);
  return t("auth.role_users", count, { named: { count } });
};

const roleIcon = (role: Role) =>
  BUILTIN_ROLE_ICONS.get(role.role_id) ?? UserCog;

const refreshRoles = async () => {
  try {
    await loadRoles({ suppressGlobalError: true });
  } catch {
    toast.error(t("auth.roles_load_failed"));
  }
};

const openEditor = (role: Role | null) => {
  roleToEdit.value = role;
  showEditor.value = true;
};

const viewRole = (role: Role) => {
  roleToView.value = role;
  showDetails.value = true;
};

// the editor when the user may change the role, its details otherwise
const openRole = (role: Role) =>
  canManageRoles.value ? openEditor(role) : viewRole(role);

const confirmDelete = (role: Role) => {
  roleToDelete.value = role;
  showDeleteDialog.value = true;
};

const deleteRole = async () => {
  const role = roleToDelete.value;
  if (!role) return;
  try {
    await api.deleteRole(role.role_id);
    toast.success(t("auth.role_deleted"));
  } catch (error) {
    toast.error(
      error instanceof ApiCommandError && error.details
        ? error.details
        : t("auth.role_delete_failed"),
    );
  }
  await refreshRoles();
};

onMounted(() => {
  void refreshRoles();
});
</script>
