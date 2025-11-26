<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-h6 pl-6 pb-0">
        {{ $t("auth.delete_user") }}
      </v-card-title>
      <v-card-text class="px-6 pb-2">
        <p class="text-body-1 mb-4">
          {{ $t("auth.confirm_delete_user") }}
        </p>
        <div v-if="user" class="user-name-box">
          {{ user.display_name || user.username }}
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
          @click="handleDelete"
        >
          {{ $t("auth.delete_user") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import type { User } from "@/plugins/api/interfaces";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  user: User | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  deleted: [];
}>();

const loading = ref(false);

const handleDelete = async () => {
  if (!props.user) return;

  loading.value = true;

  try {
    const success = await api.deleteUser(props.user.user_id);
    if (success) {
      toast.success(t("auth.user_deleted"));
      emit("deleted");
      emit("update:modelValue", false);
    } else {
      toast.error(t("auth.user_delete_failed"));
    }
  } catch (error) {
    toast.error(t("auth.user_delete_failed"));
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.user-name-box {
  background: rgba(var(--v-theme-error), 0.08);
  border-left: 3px solid rgb(var(--v-theme-error));
  padding: 12px 16px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.938rem;
}
</style>
