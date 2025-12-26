<template>
  <v-card>
    <v-card-title>{{ $t("auth.active_sessions") }}</v-card-title>
    <v-card-subtitle>
      {{ $t("auth.manage_active_sessions") }}
    </v-card-subtitle>
    <v-card-text>
      <div
        v-if="tokens.length === 0"
        class="d-flex flex-column align-center justify-center py-12"
      >
        <v-avatar color="grey-lighten-4" size="64" class="mb-3">
          <v-icon icon="mdi-monitor-off" size="32" color="grey-darken-1" />
        </v-avatar>
        <p class="text-medium-emphasis">{{ $t("no_content") }}</p>
      </div>
      <v-list v-else lines="two" class="pa-0">
        <v-list-item
          v-for="token in tokens"
          :key="token.token_id"
          class="rounded-lg mb-2 border"
          elevation="0"
        >
          <template #prepend>
            <v-avatar color="grey-lighten-4" class="mr-4">
              <v-icon icon="mdi-monitor" color="grey-darken-1" />
            </v-avatar>
          </template>

          <v-list-item-title class="font-weight-medium">
            {{ token.name }}
          </v-list-item-title>

          <v-list-item-subtitle>
            <span class="mr-2">
              {{ $t("created") }}: {{ formatDate(token.created_at) }}
            </span>
            <span v-if="token.last_used_at">
              • {{ $t("last_used") }}: {{ formatDate(token.last_used_at) }}
            </span>
          </v-list-item-subtitle>

          <template #append>
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              density="comfortable"
              @click.stop="emit('revoke', token)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
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
