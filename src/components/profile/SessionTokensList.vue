<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("auth.active_sessions") }}</CardTitle>
      <CardDescription>
        {{ $t("auth.manage_active_sessions") }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="tokens.length === 0" class="empty-state">
        <div
          class="flex size-16 items-center justify-center rounded-full bg-muted mb-3"
        >
          <MonitorOff :size="32" class="text-muted-foreground" />
        </div>
        <p class="text-muted-foreground">{{ $t("no_content") }}</p>
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
            <Monitor :size="20" class="text-muted-foreground" />
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
import type { AuthToken } from "@/plugins/api/interfaces";
import { Monitor, MonitorOff, Trash2 } from "lucide-vue-next";

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
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
}
</style>
