<template>
  <div class="long-lived-tokens">
    <div class="section-header-with-action">
      <div class="section-header">
        <h3>{{ $t("auth.long_lived_tokens") }}</h3>
        <p class="section-subtitle">
          {{ $t("auth.api_tokens_description") }}
        </p>
      </div>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        {{ $t("auth.create_token") }}
      </v-btn>
    </div>

    <div v-if="tokens.length === 0" class="empty-state">
      <v-avatar color="deep-purple-darken-2" size="64" class="mb-3">
        <v-icon icon="mdi-key-variant" size="32" />
      </v-avatar>
      <p class="text-medium-emphasis">{{ $t("auth.no_tokens") }}</p>
      <p class="text-caption text-medium-emphasis mt-1">
        {{ $t("auth.create_token_hint") }}
      </p>
    </div>

    <div v-else class="tokens-list">
      <ListItem v-for="token in tokens" :key="token.token_id">
        <template #prepend>
          <v-avatar color="deep-purple-darken-2" size="40">
            <v-icon icon="mdi-key-variant" size="20" />
          </v-avatar>
        </template>

        <template #title>
          <div class="ma-line-clamp-1">{{ token.name }}</div>
        </template>

        <template #subtitle>
          <div class="token-meta">
            <span>{{ $t("created") }}: {{ formatDate(token.created_at) }}</span>
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
    <CreateTokenDialog
      v-model="showCreateDialog"
      @created="handleTokenCreated"
    />
  </div>
</template>

<script setup lang="ts">
import ListItem from "@/components/ListItem.vue";
import CreateTokenDialog from "@/components/users/CreateTokenDialog.vue";
import type { AuthToken } from "@/plugins/api/interfaces";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps<{
  tokens: AuthToken[];
}>();

const emit = defineEmits<{
  revoke: [token: AuthToken];
  created: [];
}>();

const showCreateDialog = ref(false);

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const handleTokenCreated = () => {
  emit("created");
};
</script>

<style scoped>
.long-lived-tokens {
  margin-bottom: 24px;
}

.section-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.section-header {
  flex: 1;
}

.section-header h3 {
  margin-bottom: 4px;
  font-weight: 500;
}

.section-subtitle {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.813rem;
  margin: 0;
  line-height: 1.4;
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

.token-display {
  background: rgba(0, 0, 0, 0.2);
  padding: 12px;
  border-radius: 4px;
  word-break: break-all;
  font-family: "JetBrains Mono Medium", monospace;
  font-size: 0.875rem;
}

.token-display code {
  color: inherit;
}

@media (max-width: 600px) {
  .section-header-with-action {
    flex-direction: column;
    align-items: stretch;
  }

  .section-header-with-action .v-btn {
    width: 100%;
  }
}
</style>
