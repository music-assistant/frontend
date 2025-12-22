<template>
  <div class="session-tokens">
    <div class="section-header">
      <h3>{{ $t("auth.active_sessions") }}</h3>
      <p class="section-subtitle">
        {{ $t("auth.manage_active_sessions") }}
      </p>
    </div>
    <div v-if="tokens.length === 0" class="empty-state">
      <v-avatar color="blue-grey-darken-2" size="64" class="mb-3">
        <v-icon icon="mdi-devices-off" size="32" />
      </v-avatar>
      <p class="text-medium-emphasis">{{ $t("no_content") }}</p>
    </div>
    <div v-else class="tokens-list">
      <ListItem v-for="token in tokens" :key="token.token_id">
        <template #prepend>
          <v-avatar color="blue-grey-darken-2" size="40">
            <v-icon icon="mdi-devices" size="20" />
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
  </div>
</template>

<script setup lang="ts">
import ListItem from "@/components/ListItem.vue";
import type { AuthToken } from "@/plugins/api/interfaces";

defineProps<{
  tokens: AuthToken[];
}>();

const emit = defineEmits<{
  revoke: [token: AuthToken];
}>();

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};
</script>

<style scoped>
.session-tokens {
  margin-bottom: 24px;
}

.section-header {
  margin-bottom: 12px;
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
</style>
