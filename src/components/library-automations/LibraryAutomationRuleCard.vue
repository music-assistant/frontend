<template>
  <Card class="p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex items-center gap-2">
          <Switch
            :model-value="rule.enabled"
            :aria-label="rule.name"
            @update:model-value="onToggle"
          />
          <span class="truncate font-medium">{{ rule.name }}</span>
        </div>
        <div
          class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Badge variant="secondary">{{ triggerLabel }}</Badge>
          <span aria-hidden="true">&rarr;</span>
          <Badge variant="secondary">{{ actionLabel }}</Badge>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost-icon"
            size="icon-sm"
            :aria-label="$t('more_options')"
          >
            <MoreVertical class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="emit('edit', rule)">
            {{ $t("providers.library_automations.card.edit") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            :disabled="isDeleting"
            @click="onDelete"
          >
            {{ $t("providers.library_automations.card.delete") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useLibraryAutomationRules } from "@/composables/library-automations/useLibraryAutomationRules";
import {
  errorMessage,
  localizedActionTitle,
  localizedTriggerTitle,
} from "@/helpers/library_automations";
import type { LibraryAutomationRule } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { MoreVertical } from "@lucide/vue";
import { computed } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{
  rule: LibraryAutomationRule;
}>();

const emit = defineEmits<{
  edit: [rule: LibraryAutomationRule];
}>();

const {
  triggerTypes,
  actionTypes,
  deletingRuleId,
  deleteRule,
  setRuleEnabled,
} = useLibraryAutomationRules();

const isDeleting = computed(() => deletingRuleId.value === props.rule.id);

const triggerLabel = computed(() => {
  const triggerId = props.rule.trigger.type;
  const fallback =
    triggerTypes.value.find((t) => t.id === triggerId)?.label || triggerId;
  return localizedTriggerTitle(triggerId, fallback);
});
const actionLabel = computed(() => {
  const actionId = props.rule.action.type;
  const fallback =
    actionTypes.value.find((t) => t.id === actionId)?.label || actionId;
  return localizedActionTitle(actionId, fallback);
});

async function onToggle(enabled: boolean) {
  try {
    await setRuleEnabled(props.rule.id, enabled);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

function onDelete() {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.library_automations.confirm.delete_title"),
    message: $t("providers.library_automations.confirm.delete_message"),
    confirmLabel: $t("providers.library_automations.confirm.delete_confirm"),
    onConfirm: async () => {
      try {
        await deleteRule(props.rule.id);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
  });
}
</script>
