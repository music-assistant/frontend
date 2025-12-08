<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title
        class="text-h6 pa-6"
        :class="{ 'pb-0': createdToken, 'pb-4': !createdToken }"
      >
        {{ createdToken ? tokenName : $t("auth.create_token") }}
      </v-card-title>
      <v-card-text class="px-6 pb-2">
        <template v-if="!createdToken">
          <v-text-field
            v-model="tokenName"
            :label="$t('auth.token_name')"
            variant="outlined"
            density="comfortable"
            :hint="$t('auth.token_name_hint')"
            persistent-hint
            autofocus
          />
        </template>

        <template v-else>
          <p class="text-body-2 mb-2 text-grey-darken-1">
            {{ $t("auth.copy_new_token_hint") }}
          </p>
          <v-text-field
            v-model="createdToken"
            readonly
            variant="outlined"
            density="comfortable"
            class="mb-2"
            :append-inner-icon="'mdi-content-copy'"
            @click:append-inner="copyToken"
          />
        </template>
      </v-card-text>
      <template v-if="!createdToken">
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
      </template>
      <template v-else>
        <v-card-actions class="px-6 pb-6 pt-0">
          <v-btn color="primary" variant="tonal" @click="handleClose">
            {{ $t("close") }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";
import { copyToClipboard } from "@/helpers/utils";

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
const createdToken = ref("");

const handleClose = () => {
  tokenName.value = "";
  createdToken.value = "";
  requestAnimationFrame(() => {
    emit("update:modelValue", false);
  });
};

const handleCreate = async () => {
  loading.value = true;

  try {
    const token = await api.createToken(tokenName.value, props.userId);
    if (token) {
      toast.success(t("auth.token_created"));
      createdToken.value = token;
      emit("created");
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
      createdToken.value = "";
    }
  },
);

const copyToken = async () => {
  if (!createdToken.value) return;

  const success = await copyToClipboard(createdToken.value);
  if (success) {
    toast.success(t("auth.token_copied"));
  } else {
    toast.error(t("auth.token_copy_failed"));
  }
};
</script>
