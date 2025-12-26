<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>
        {{ createdToken ? tokenName : $t("auth.create_token") }}
      </v-card-title>
      <v-card-subtitle v-if="!createdToken">
        {{ $t("auth.token_name_hint") }}
      </v-card-subtitle>

      <v-card-text class="py-4">
        <div v-if="!createdToken">
          <form id="form-create-token" @submit.prevent="form.handleSubmit">
            <form.Field
              name="tokenName"
              :validators="{
                onChange: tokenNameSchema(t),
              }"
            >
              <template #default="{ field }">
                <v-text-field
                  :id="field.name"
                  :name="field.name"
                  :model-value="tokenName"
                  :label="$t('auth.token_name')"
                  :placeholder="$t('auth.token_name_hint')"
                  :error-messages="field.state.meta.errors"
                  autofocus
                  autocomplete="off"
                  variant="outlined"
                  @blur="field.handleBlur"
                  @input="
                    (e: Event) => {
                      tokenName = (e.target as HTMLInputElement).value;
                      field.handleChange((e.target as HTMLInputElement).value);
                    }
                  "
                />
              </template>
            </form.Field>
          </form>
        </div>

        <div v-else>
          <p class="text-body-2 text-medium-emphasis mb-4">
            {{ $t("auth.copy_new_token_hint") }}
          </p>
          <v-text-field
            :model-value="createdToken"
            readonly
            variant="outlined"
            density="comfortable"
            class="font-monospace"
            append-inner-icon="mdi-content-copy"
            @click:append-inner="copyToken"
          />
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <template v-if="!createdToken">
          <v-btn variant="text" @click="handleClose">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn
            type="submit"
            form="form-create-token"
            color="primary"
            :disabled="!canCreate"
            :loading="loading"
          >
            {{ $t("create") }}
          </v-btn>
        </template>
        <template v-else>
          <v-btn color="primary" @click="handleClose">
            {{ $t("close") }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

import { copyToClipboard } from "@/helpers/utils";
import { createTokenSchema, tokenNameSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";

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
const createdToken = ref("");
const tokenName = ref("");

const form = useForm({
  defaultValues: {
    tokenName: "",
  },
  validators: {
    onSubmit: createTokenSchema(t) as any,
  },
  onSubmit: async ({ value }) => {
    loading.value = true;

    try {
      const token = await api.createToken(value.tokenName, props.userId);
      if (token) {
        toast.success(t("auth.token_created"));
        createdToken.value = token;
        tokenName.value = value.tokenName;
        emit("created");
      } else {
        toast.error(t("auth.token_create_failed"));
      }
    } catch (error: any) {
      toast.error(error.message || t("auth.token_create_failed"));
    } finally {
      loading.value = false;
    }
  },
});

const canCreate = computed(() => {
  const name = tokenName.value || "";
  return name.trim().length > 0 && name.length <= 100 && !loading.value;
});

const handleClose = () => {
  form.reset();
  createdToken.value = "";
  tokenName.value = "";
  requestAnimationFrame(() => {
    emit("update:modelValue", false);
  });
};

const copyToken = async () => {
  if (!createdToken.value) return;

  const success = await copyToClipboard(createdToken.value);
  if (success) {
    toast.success(t("auth.token_copied"));
  } else {
    toast.error(t("auth.token_copy_failed"));
  }
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (!newVal) {
      form.reset();
      createdToken.value = "";
      tokenName.value = "";
    } else {
      tokenName.value = "";
    }
  },
);
</script>

<style scoped>
.font-monospace :deep(input) {
  font-family: monospace;
}
</style>
