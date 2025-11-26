<template>
  <v-dialog
    :model-value="modelValue"
    max-width="900"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="text-h6 pa-6 pb-4">
        {{ $t("auth.tokens") }} -
        {{ user?.display_name || user?.username }}
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-0">
        <div class="pa-4">
          <h3 class="mb-2">{{ $t("auth.active_sessions") }}</h3>
          <p class="section-subtitle mb-6">
            {{ $t("auth.active_sessions_description") }}
          </p>
          <div v-if="sessionTokens.length === 0" class="empty-state">
            <v-avatar color="blue-grey-darken-2" size="64" class="mb-3">
              <v-icon icon="mdi-devices" size="32" />
            </v-avatar>
            <p class="text-medium-emphasis">
              {{ $t("auth.no_active_sessions") }}
            </p>
          </div>
          <div v-else class="tokens-list">
            <ListItem v-for="token in sessionTokens" :key="token.token_id">
              <template #prepend>
                <v-avatar color="blue-grey-darken-2" size="40">
                  <v-icon icon="mdi-devices" size="20" />
                </v-avatar>
              </template>
              <template #title>
                <div class="line-clamp-1">{{ token.name }}</div>
              </template>
              <template #subtitle>
                <div class="token-meta">
                  <span
                    >{{ $t("created") }}:
                    {{ formatDate(token.created_at) }}</span
                  >
                  <span v-if="token.last_used_at" class="token-divider">•</span>
                  <span v-if="token.last_used_at">
                    {{ $t("last_used") }}: {{ formatDate(token.last_used_at) }}
                  </span>
                </div>
              </template>
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  color="error"
                  size="small"
                  @click.stop="emit('revoke', token)"
                />
              </template>
            </ListItem>
          </div>
        </div>
        <div class="pa-4">
          <div class="section-header-with-action">
            <div class="w-100">
              <div class="d-flex justify-space-between align-center gap-2">
                <h3 class="mb-2">{{ $t("auth.long_lived_tokens") }}</h3>
                <v-btn
                  color="primary"
                  variant="flat"
                  prepend-icon="mdi-plus"
                  size="small"
                  @click="showCreateDialog = true"
                >
                  {{ $t("auth.create_token") }}
                </v-btn>
              </div>
              <p class="section-subtitle">
                {{ $t("auth.long_lived_tokens_description") }}
              </p>
            </div>
          </div>
          <div v-if="longLivedTokens.length === 0" class="empty-state">
            <v-avatar color="deep-purple-darken-2" size="64" class="mb-3">
              <v-icon icon="mdi-key-variant" size="32" />
            </v-avatar>
            <p class="text-medium-emphasis">
              {{ $t("auth.no_long_lived_tokens") }}
            </p>
          </div>
          <div v-else class="tokens-list">
            <ListItem v-for="token in longLivedTokens" :key="token.token_id">
              <template #prepend>
                <v-avatar color="deep-purple-darken-2" size="40">
                  <v-icon icon="mdi-key-variant" size="20" />
                </v-avatar>
              </template>
              <template #title>
                <div class="line-clamp-1">{{ token.name }}</div>
              </template>
              <template #subtitle>
                <div class="token-meta">
                  <span
                    >{{ $t("created") }}:
                    {{ formatDate(token.created_at) }}</span
                  >
                  <span v-if="token.last_used_at" class="token-divider">•</span>
                  <span v-if="token.last_used_at">
                    {{ $t("last_used") }}: {{ formatDate(token.last_used_at) }}
                  </span>
                </div>
              </template>
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  color="error"
                  size="small"
                  @click.stop="emit('revoke', token)"
                />
              </template>
            </ListItem>
          </div>
        </div>
      </v-card-text>
      <v-card-actions class="pa-6">
        <v-spacer />
        <v-btn variant="tonal" @click="emit('update:modelValue', false)">
          {{ $t("close") }}
        </v-btn>
      </v-card-actions>
    </v-card>
    <CreateTokenDialog
      v-model="showCreateDialog"
      :user-id="user?.user_id"
      @created="emit('token-created')"
    />
  </v-dialog>
</template>

<script setup lang="ts">
import ListItem from "@/components/ListItem.vue";
import type { AuthToken, User } from "@/plugins/api/interfaces";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import CreateTokenDialog from "./CreateTokenDialog.vue";

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

const showCreateDialog = ref(false);

const sessionTokens = computed(() =>
  props.tokens.filter((token) => !token.is_long_lived),
);

const longLivedTokens = computed(() =>
  props.tokens.filter((token) => token.is_long_lived),
);

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};
</script>

<style scoped>
.section-subtitle {
  color: var(--v-theme-secondary);
  font-size: 0.813rem;
  margin: 0;
  line-height: 1.4;
  margin-bottom: 12px;
  margin-top: 16px;
}

.section-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  border: 2px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  text-align: center;
}

.empty-state .v-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.empty-state .v-avatar .v-icon {
  margin: 0 !important;
}

.tokens-list {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow: hidden;
  padding: 10px;
}

.token-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.875rem;
}

.token-divider {
  color: rgb(var(--v-theme-on-surface-variant));
}

.tokens-list :deep(.v-avatar) {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.tokens-list :deep(.v-avatar .v-icon) {
  margin: 0 !important;
}

@media (max-width: 600px) {
  .section-header-with-action {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
