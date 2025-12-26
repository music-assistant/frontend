<template>
  <v-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" max-width="400">
    <v-card>
      <v-card-title class="px-4 pt-4">
        {{
          token?.is_long_lived
            ? $t("auth.revoke_token")
            : $t("auth.revoke_session")
        }}
      </v-card-title>
      
      <v-card-text class="px-4 py-4">
        <p class="text-body-2 text-medium-emphasis mb-4">
          {{
            token?.is_long_lived
              ? $t("auth.revoke_token_confirm")
              : $t("auth.revoke_session_confirm")
          }}
        </p>
        <v-card
          v-if="token"
          variant="tonal"
          color="error"
          class="pa-4"
        >
          <p class="font-weight-medium">{{ token.name }}</p>
        </v-card>
      </v-card-text>

      <v-card-actions class="px-4 pb-4">
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
