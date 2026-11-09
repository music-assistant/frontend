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
          @update:model-value="
            (checked) => (selection = checked ? { all_users: true } : {})
          "
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
          {{ statisticsUserName(user) }}
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
import { statisticsUserName } from "@/composables/useStatistics";
import type { StatisticsUsers, User } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ChevronDown } from "@lucide/vue";
import { computed, useId } from "vue";

const props = defineProps<{
  users: User[];
}>();
// empty is the current user only, which the statistics commands default to
const selection = defineModel<StatisticsUsers>({ required: true });

const labelId = useId();
const buttonId = useId();

const allUserIds = computed(() => props.users.map((user) => user.user_id));
const selected = computed(() => {
  if (selection.value.all_users) return allUserIds.value;
  if (selection.value.users?.length) return selection.value.users;
  return [store.currentUser?.user_id].filter((id) => id !== undefined);
});
const allSelected = computed(
  () =>
    selection.value.all_users === true ||
    (allUserIds.value.length > 0 &&
      allUserIds.value.every((id) => selected.value.includes(id))),
);

const summary = computed(() => {
  if (allSelected.value) return $t("statistics_users_all");
  const ids = selection.value.users ?? [];
  if (!ids.length) return $t("statistics_users_me");
  if (ids.length === 1) {
    const user = props.users.find((u) => u.user_id === ids[0]);
    if (user) return statisticsUserName(user);
  }
  return $t("statistics_users_count", { count: ids.length });
});

function toggle(userId: string, checked: boolean | "indeterminate") {
  const ids =
    checked === true
      ? [...selected.value, userId]
      : selected.value.filter((id) => id !== userId);
  const onlyMe = ids.length === 1 && ids[0] === store.currentUser?.user_id;
  if (onlyMe || !ids.length) selection.value = {};
  else if (allUserIds.value.every((id) => ids.includes(id))) {
    selection.value = { all_users: true };
  } else selection.value = { users: ids };
}
</script>
