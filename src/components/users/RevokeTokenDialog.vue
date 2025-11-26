<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-h6 pa-6 pb-4">
        {{
          token?.is_long_lived
            ? $t("auth.revoke_token")
            : $t("auth.revoke_session")
        }}
      </v-card-title>
      <v-card-text class="px-6 pb-2">
        <p class="text-body-1 mb-4">
          {{
            token?.is_long_lived
              ? $t("auth.revoke_token_confirm")
              : $t("auth.revoke_session_confirm")
          }}
        </p>
        <div v-if="token" class="token-name-box">
          {{ token.name }}
        </div>
      </v-card-text>
      <v-card-actions class="pa-6 pt-4">
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">
          {{ $t("cancel") }}
        </v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="loading"
          @click="handleRevoke"
        >
          {{ $t("auth.revoke") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import type { AuthToken } from "@/plugins/api/interfaces";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

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

<style scoped>
.token-name-box {
  background: rgba(var(--v-theme-error), 0.08);
  border-left: 3px solid rgb(var(--v-theme-error));
  padding: 12px 16px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.938rem;
}
</style>
