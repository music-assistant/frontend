<template>
  <div class="flex items-center gap-3">
    <span :id="labelId" class="text-[13px] text-muted-foreground">
      {{ $t("statistics_users") }}
    </span>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          :id="buttonId"
          variant="outline"
          class="cursor-pointer"
          :aria-labelledby="`${labelId} ${buttonId}`"
        >
          {{ summary }}
          <ChevronDown class="size-4 opacity-50" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          :model-value="allSelected"
          @select="(event: Event) => event.preventDefault()"
          @update:model-value="(checked) => select(checked ? allUserIds : [])"
        >
          {{ $t("statistics_users_all") }}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          v-for="user in users"
          :key="user.user_id"
          :model-value="selected.includes(user.user_id)"
          @select="(event: Event) => event.preventDefault()"
          @update:model-value="(checked) => toggle(user.user_id, checked)"
        >
          {{ user.display_name || user.username }}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import api from "@/plugins/api";
import type { User } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ChevronDown } from "@lucide/vue";
import { computed, onMounted, shallowRef, useId } from "vue";

// empty is the current user only, which the statistics commands default to
const userIds = defineModel<string[]>({ required: true });

const labelId = useId();
const buttonId = useId();
const users = shallowRef<User[]>([]);

onMounted(async () => {
  users.value = await api.getAllUsers();
});

const allUserIds = computed(() => users.value.map((user) => user.user_id));
const selected = computed(() =>
  userIds.value.length
    ? userIds.value
    : [store.currentUser?.user_id].filter((id) => id !== undefined),
);
const allSelected = computed(
  () =>
    allUserIds.value.length > 0 &&
    allUserIds.value.every((id) => selected.value.includes(id)),
);

const summary = computed(() => {
  if (!userIds.value.length) return $t("statistics_users_me");
  if (allSelected.value) return $t("statistics_users_all");
  if (userIds.value.length === 1) {
    const user = users.value.find((u) => u.user_id === userIds.value[0]);
    if (user) return user.display_name || user.username;
  }
  return $t("statistics_users_count", { count: userIds.value.length });
});

function toggle(userId: string, checked: boolean | "indeterminate") {
  select(
    checked === true
      ? [...selected.value, userId]
      : selected.value.filter((id) => id !== userId),
  );
}

function select(ids: readonly string[]) {
  // in the order of the user list, so the url stays the same for the same users
  const ordered = allUserIds.value.filter((id) => ids.includes(id));
  const onlyMe =
    ordered.length === 1 && ordered[0] === store.currentUser?.user_id;
  userIds.value = onlyMe ? [] : ordered;
}
</script>
