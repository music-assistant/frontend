<template>
  <Card>
    <CardHeader>
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <CardTitle>{{ $t("auth.long_lived_tokens") }}</CardTitle>
          <CardDescription>
            {{ $t("auth.api_tokens_description") }}
          </CardDescription>
        </div>
        <Button @click="showCreateDialog = true">
          <Plus :size="16" />
          {{ $t("auth.create_token") }}
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div v-if="tokens.length === 0" class="empty-state">
        <div
          class="flex size-16 items-center justify-center rounded-full bg-muted mb-3"
        >
          <Key :size="32" class="text-muted-foreground" />
        </div>
        <p class="text-muted-foreground font-medium">
          {{ $t("auth.no_tokens") }}
        </p>
        <p class="text-sm text-muted-foreground mt-1">
          {{ $t("auth.create_token_hint") }}
        </p>
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="token in tokens"
          :key="token.token_id"
          class="flex items-center gap-4 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
        >
          <div
            class="flex size-10 items-center justify-center rounded-full bg-muted"
          >
            <Key :size="20" class="text-muted-foreground" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ token.name }}</div>
            <div class="text-sm text-muted-foreground flex flex-wrap gap-2">
              <span
                >{{ $t("created") }}: {{ formatDate(token.created_at) }}</span
              >
              <span v-if="token.last_used_at">•</span>
              <span v-if="token.last_used_at">
                {{ $t("last_used") }}: {{ formatDate(token.last_used_at) }}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="text-destructive hover:text-destructive hover:bg-destructive/10"
            @click.stop="emit('revoke', token)"
          >
            <Trash2 :size="16" />
          </Button>
        </div>
      </div>
    </CardContent>
    <CreateTokenDialog
      v-model="showCreateDialog"
      @created="handleTokenCreated"
    />
  </Card>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CreateTokenDialog from "@/components/users/CreateTokenDialog.vue";
import type { AuthToken } from "@/plugins/api/interfaces";
import { Key, Plus, Trash2 } from "lucide-vue-next";
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
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}
</style>
