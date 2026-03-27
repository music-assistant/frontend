<template>
  <Dialog
    :open="modelValue"
    @update:open="emit('update:modelValue', $event)"
  >
    <DialogContent class="max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{{ $t("auth.disable_user") }}</DialogTitle>
        <DialogDescription class="sr-only">{{ $t('aria.confirm_disable_user') }}</DialogDescription>
      </DialogHeader>
      <div class="py-2">
        <p class="text-sm mb-4">
          {{ $t("auth.confirm_disable_user") }}
        </p>
        <div v-if="user" class="user-name-box">
          {{ user.display_name || user.username }}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:modelValue', false)">
          {{ $t("cancel") }}
        </Button>
        <Button
          variant="destructive"
          :loading="loading"
          @click="handleDisable"
        >
          {{ $t("auth.disable_user") }}
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
import { api } from "@/plugins/api";
import type { User } from "@/plugins/api/interfaces";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  user: User | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  disabled: [];
}>();

const loading = ref(false);

const handleDisable = async () => {
  if (!props.user) return;

  loading.value = true;

  try {
    const success = await api.disableUser(props.user.user_id);
    if (success) {
      toast.success(t("auth.user_disabled"));
      emit("disabled");
      emit("update:modelValue", false);
    } else {
      toast.error(t("auth.user_disable_failed"));
    }
  } catch (error) {
    toast.error(t("auth.user_disable_failed"));
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
/* .user-name-box is inside DialogContent which teleports to <body>,
   so it needs :global() to bypass scoped attribute matching. */
:global(.user-name-box) {
  background: color-mix(in srgb, var(--destructive) 8%, transparent);
  border-left: 3px solid var(--destructive);
  padding: 12px 16px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.938rem;
}
</style>
