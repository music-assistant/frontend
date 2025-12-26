<template>
  <v-dialog v-model="isOpen" max-width="900" scrollable>
    <v-card>
      <v-card-title class="px-4 pt-4">
        {{ $t("auth.tokens") }} -
        {{ user?.display_name || user?.username }}
      </v-card-title>

      <v-card-text class="px-4 py-2" style="max-height: 90vh; overflow-y: auto">
        <div class="d-flex flex-column gap-4">
          <!-- Active Sessions Section -->
          <div>
            <h3 class="text-subtitle-1 font-weight-bold mb-1 mt-2">
              {{ $t("auth.active_sessions") }}
            </h3>
            <p class="text-body-2 text-medium-emphasis mb-4">
              {{ $t("auth.active_sessions_description") }}
            </p>
            
            <div
              v-if="sessionTokens.length === 0"
              class="d-flex flex-column align-center justify-center py-12 border-dashed rounded-lg"
              style="border: 2px dashed rgba(var(--v-theme-on-surface), 0.12)"
            >
              <v-avatar color="primary" variant="tonal" size="64" class="mb-3">
                <v-icon icon="mdi-monitor" size="32" color="primary" />
              </v-avatar>
              <p class="text-body-2 text-medium-emphasis">
                {{ $t("auth.no_active_sessions") }}
              </p>
            </div>
            
            <div v-else class="d-flex flex-column gap-2">
              <v-card
                v-for="token in sessionTokens"
                :key="token.token_id"
                variant="outlined"
                class="pa-4"
              >
                <div class="d-flex align-center gap-4">
                  <v-avatar color="primary" variant="tonal" size="40">
                    <v-icon icon="mdi-monitor" size="20" color="primary" />
                  </v-avatar>
                  
                  <div class="flex-grow-1" style="min-width: 0">
                    <div class="text-body-2 font-weight-medium text-truncate">
                      {{ token.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis d-flex align-center gap-2 flex-wrap">
                      <span>
                        {{ $t("created") }}: {{ formatDate(token.created_at) }}
                      </span>
                      <span v-if="token.last_used_at">•</span>
                      <span v-if="token.last_used_at">
                        {{ $t("last_used") }}: {{ formatDate(token.last_used_at) }}
                      </span>
                    </div>
                  </div>
                  
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    @click.stop="emit('revoke', token)"
                  />
                </div>
              </v-card>
            </div>
          </div>

          <!-- Long Lived Tokens Section -->
          <div>
            <div class="d-flex align-start justify-space-between gap-4 mb-4">
              <div class="flex-grow-1">
                <h3 class="text-subtitle-1 font-weight-bold mb-1">
                  {{ $t("auth.long_lived_tokens") }}
                </h3>
                <p class="text-body-2 text-medium-emphasis">
                  {{ $t("auth.long_lived_tokens_description") }}
                </p>
              </div>
              <v-btn
                v-if="!showCreateForm"
                size="small"
                prepend-icon="mdi-plus"
                @click="showCreateForm = true"
              >
                {{ $t("auth.create_token") }}
              </v-btn>
              <v-btn
                v-else
                variant="outlined"
                size="small"
                @click="showCreateForm = false"
              >
                {{ $t("cancel") }}
              </v-btn>
            </div>

            <v-card v-if="showCreateForm" variant="outlined" class="pa-4 mb-4" color="primary">
              <form id="form-create-token" @submit.prevent="handleCreateToken">
                <form.Field name="tokenName">
                  <template #default="{ field }">
                    <v-text-field
                      :id="field.name"
                      :name="field.name"
                      v-model="tokenName"
                      :label="$t('auth.token_name')"
                      :placeholder="$t('auth.token_name_hint')"
                      :error-messages="field.state.meta.errors"
                      variant="outlined"
                      autofocus
                      autocomplete="off"
                      @blur="field.handleBlur"
                      @update:model-value="(val) => {
                        tokenName = val;
                        field.handleChange(val);
                      }"
                    />
                  </template>
                </form.Field>
                <div class="d-flex justify-end gap-2 mt-2">
                  <v-btn variant="text" @click="showCreateForm = false">
                    {{ $t("cancel") }}
                  </v-btn>
                  <v-btn
                    type="submit"
                    color="primary"
                    :disabled="!canCreate"
                    :loading="creating"
                  >
                    {{ $t("create") }}
                  </v-btn>
                </div>
              </form>
            </v-card>

            <v-card
              v-if="createdToken"
              variant="tonal"
              color="error"
              class="pa-4 mb-4"
            >
              <p class="text-body-2 text-medium-emphasis mb-2">
                {{ $t("auth.copy_new_token_hint") }}
              </p>
              <v-text-field
                :model-value="createdToken"
                readonly
                variant="outlined"
                density="compact"
                hide-details
                class="font-monospace"
              >
                <template #append-inner>
                  <v-btn
                    icon="mdi-content-copy"
                    variant="text"
                    size="small"
                    @click="copyToken"
                  />
                </template>
              </v-text-field>
              <v-btn
                variant="outlined"
                class="mt-4 w-100"
                @click="handleCloseCreateForm"
              >
                {{ $t("close") }}
              </v-btn>
            </v-card>

            <div
              v-if="longLivedTokens.length === 0"
              class="d-flex flex-column align-center justify-center py-12 border-dashed rounded-lg"
              style="border: 2px dashed rgba(var(--v-theme-on-surface), 0.12)"
            >
              <v-avatar color="secondary" variant="tonal" size="64" class="mb-3">
                <v-icon icon="mdi-key" size="32" color="secondary" />
              </v-avatar>
              <p class="text-body-2 text-medium-emphasis">
                {{ $t("auth.no_long_lived_tokens") }}
              </p>
            </div>
            
            <div v-else class="d-flex flex-column gap-2">
              <v-card
                v-for="token in longLivedTokens"
                :key="token.token_id"
                variant="outlined"
                class="pa-4"
              >
                <div class="d-flex align-center gap-4">
                  <v-avatar color="secondary" variant="tonal" size="40">
                    <v-icon icon="mdi-key" size="20" color="secondary" />
                  </v-avatar>
                  
                  <div class="flex-grow-1" style="min-width: 0">
                    <div class="text-body-2 font-weight-medium text-truncate">
                      {{ token.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis d-flex align-center gap-2 flex-wrap">
                      <span>
                        {{ $t("created") }}: {{ formatDate(token.created_at) }}
                      </span>
                      <span v-if="token.last_used_at">•</span>
                      <span v-if="token.last_used_at">
                        {{ $t("last_used") }}: {{ formatDate(token.last_used_at) }}
                      </span>
                    </div>
                  </div>
                  
                  <v-btn
                    icon="mdi-delete"
                    variant="text"
                    color="error"
                    size="small"
                    @click.stop="emit('revoke', token)"
                  />
                </div>
              </v-card>
            </div>
          </div>
        </div>
      </v-card-text>

      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="outlined" @click="emit('update:modelValue', false)">
          {{ $t("close") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useForm } from "@tanstack/vue-form";
import { useVModel } from "@vueuse/core";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vuetify-sonner";

import { copyToClipboard } from "@/helpers/utils";
import { createTokenSchema, tokenNameSchema } from "@/lib/forms/profile";
import { api } from "@/plugins/api";
import type { AuthToken, User } from "@/plugins/api/interfaces";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  user: User | null;
  tokens: AuthToken[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  revoke: [token: AuthToken];
  "token-created": [];
}>();

const isOpen = useVModel(props, "modelValue", emit);

const showCreateForm = ref(false);
const creating = ref(false);
const tokenName = ref("");
const createdToken = ref("");

const sessionTokens = computed(() =>
  props.tokens.filter((token) => !token.is_long_lived),
);

const longLivedTokens = computed(() =>
  props.tokens.filter((token) => token.is_long_lived),
);

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const form = useForm({
  defaultValues: {
    tokenName: "",
  },
  validators: {
    onSubmit: createTokenSchema(t) as any,
  },
  onSubmit: async () => {
    // Handled in handleCreateToken
  },
});

const canCreate = computed(() => {
  const name = tokenName.value || "";
  return name.trim().length > 0 && name.length <= 100 && !creating.value;
});

const handleCreateToken = async () => {
  if (!props.user || !canCreate.value) return;

  creating.value = true;

  try {
    const token = await api.createToken(tokenName.value, props.user.user_id);

    if (token) {
      createdToken.value = token;
      tokenName.value = "";
      showCreateForm.value = false;
      form.reset();
      emit("token-created");
      toast.success(t("auth.token_created"));
    } else {
      toast.error(t("auth.token_create_failed"));
    }
  } catch (error: any) {
    toast.error(error.message || t("auth.token_create_failed"));
  } finally {
    creating.value = false;
  }
};

const copyToken = async () => {
  if (createdToken.value) {
    await copyToClipboard(createdToken.value);
    toast.success(t("auth.token_copied"));
  }
};

const handleCloseCreateForm = () => {
  createdToken.value = "";
  tokenName.value = "";
  showCreateForm.value = false;
  form.reset();
};
</script>

<style scoped>
.font-monospace {
  font-family: monospace;
}
</style>
