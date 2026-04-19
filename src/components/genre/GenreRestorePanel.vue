<template>
  <Button
    :variant="destructive ? 'destructive' : 'outline'"
    size="sm"
    :disabled="loading"
    @click="$emit('restore')"
  >
    <Spinner v-if="loading" />
    <AlertTriangle v-else-if="destructive" class="size-4" />
    <RefreshCw v-else class="size-4" />
    {{ buttonText }}
  </Button>
</template>

<script setup lang="ts">
import { AlertTriangle, RefreshCw } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface Props {
  buttonText: string;
  loading: boolean;
  destructive?: boolean;
}

defineProps<Props>();
defineEmits<{ restore: [] }>();
</script>
