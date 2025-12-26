<template>
  <div>
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        {{ $t("auth.long_lived_tokens") }}
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="showCreateDialog = true"
        >
          {{ $t("auth.create_token") }}
        </v-btn>
      </v-card-title>
      <v-card-subtitle>
        {{ $t("auth.api_tokens_description") }}
      </v-card-subtitle>
      <v-card-text>
        <div v-if="tokens.length === 0" class="d-flex flex-column align-center justify-center py-12 text-center">
          <v-avatar color="grey-lighten-4" size="64" class="mb-3">
            <v-icon icon="mdi-key" size="32" color="grey-darken-1" />
          </v-avatar>
          <p class="font-weight-medium text-medium-emphasis mb-1">
            {{ $t("auth.no_tokens") }}
          </p>
          <p class="text-caption text-disabled">
            {{ $t("auth.create_token_hint") }}
          </p>
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
                <v-icon icon="mdi-key" color="grey-darken-1" />
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
      <CreateTokenDialog
        v-model="showCreateDialog"
        @created="handleTokenCreated"
      />
    </v-card>
  </div>
</template>

<script setup lang="ts">
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
