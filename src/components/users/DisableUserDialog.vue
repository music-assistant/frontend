<template>
  <AlertDialog
    :open="modelValue"
    @update:open="emit('update:modelValue', $event)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ $t("auth.disable_user") }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("auth.confirm_disable_user") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div v-if="user" class="bg-destructive/10 rounded-md p-4 font-medium">
        {{ user.display_name || user.username }}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("cancel") }}</AlertDialogCancel>
        <Button variant="destructive" :loading="loading" @click="handleDisable">
          {{ $t("auth.disable_user") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
