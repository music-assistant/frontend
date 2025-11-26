<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-h6 pa-6 pb-4">
        {{ $t("auth.create_token") }}
      </v-card-title>
      <v-card-text class="px-6 pb-2">
        <v-text-field
          v-model="tokenName"
          :label="$t('auth.token_name')"
          variant="outlined"
          density="comfortable"
          :hint="$t('auth.token_name_hint')"
          persistent-hint
          autofocus
        />
      </v-card-text>
      <v-card-actions class="pa-6 pt-4">
        <v-spacer />
        <v-btn variant="text" @click="handleClose">
          {{ $t("cancel") }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="loading"
          :disabled="!tokenName"
          @click="handleCreate"
        >
          {{ $t("create") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  userId?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  created: [];
}>();

const loading = ref(false);
const tokenName = ref("");

const handleClose = () => {
  tokenName.value = "";
  emit("update:modelValue", false);
};

const handleCreate = async () => {
  if (!props.userId) return;

  loading.value = true;

  try {
    const token = await api.createToken(tokenName.value, props.userId);
    if (token) {
      toast.success(t("auth.token_created"));
      emit("created");
      handleClose();
    } else {
      toast.error(t("auth.token_create_failed"));
    }
  } catch (error: any) {
    toast.error(error.message || t("auth.token_create_failed"));
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (!newVal) {
      tokenName.value = "";
    }
  },
);
</script>
