<template>
  <Dialog :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{
            token?.is_long_lived
              ? $t("auth.revoke_token")
              : $t("auth.revoke_session")
          }}
        </DialogTitle>
      </DialogHeader>
      <div class="py-4">
        <p class="text-sm text-muted-foreground mb-4">
          {{
            token?.is_long_lived
              ? $t("auth.revoke_token_confirm")
              : $t("auth.revoke_session_confirm")
          }}
        </p>
        <div v-if="token" class="rounded-md bg-destructive/10 p-4">
          <p class="font-medium">{{ token.name }}</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:modelValue', false)">
          {{ $t("cancel") }}
        </Button>
        <Button variant="destructive" :loading="loading" @click="handleRevoke">
          {{ $t("auth.revoke") }}
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/plugins/api";
import type { AuthToken } from "@/plugins/api/interfaces";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  token: AuthToken | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  revoked: [];
}>();

const loading = ref(false);

const handleRevoke = async () => {
  if (!props.token) return;

  loading.value = true;
  const isSession = !props.token.is_long_lived;

  try {
    const success = await api.revokeToken(props.token.token_id);
    if (success) {
      toast.success(
        isSession ? t("auth.session_revoked") : t("auth.token_revoked"),
      );
      emit("revoked");
      emit("update:modelValue", false);
    } else {
      toast.error(
        isSession
          ? t("auth.session_revoke_failed")
          : t("auth.token_revoke_failed"),
      );
    }
  } catch (error) {
    toast.error(
      isSession
        ? t("auth.session_revoke_failed")
        : t("auth.token_revoke_failed"),
    );
  } finally {
    loading.value = false;
  }
};
</script>
