<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <Item variant="outline" size="sm" class="justify-between">
        <ItemContent>
          <ItemTitle>{{ $t("settings.scanner_status") }}</ItemTitle>
        </ItemContent>
        <ItemContent class="flex-none text-right">
          <span class="flex items-center gap-1.5 text-sm font-medium">
            <Loader2
              v-if="status?.running"
              class="size-3 animate-spin text-primary"
            />
            <span v-else class="size-2 rounded-full bg-green-500"></span>
            {{
              status?.running
                ? $t("settings.scanner_running")
                : $t("settings.scanner_idle")
            }}
          </span>
        </ItemContent>
      </Item>

      <Item variant="outline" size="sm" class="justify-between">
        <ItemContent>
          <ItemTitle>{{ $t("settings.last_scan") }}</ItemTitle>
        </ItemContent>
        <ItemContent class="flex-none text-right">
          <span class="text-sm font-medium">{{ lastScanDisplay }}</span>
        </ItemContent>
      </Item>

      <Item variant="outline" size="sm" class="justify-between">
        <ItemContent>
          <ItemTitle>{{ $t("settings.last_scan_mapped") }}</ItemTitle>
        </ItemContent>
        <ItemContent class="flex-none text-right">
          <span class="text-sm font-medium">
            {{
              status?.last_scan_mapped != null ? status.last_scan_mapped : "..."
            }}
          </span>
        </ItemContent>
      </Item>
    </div>

    <Button
      variant="outline"
      size="sm"
      :disabled="triggering || !!status?.running"
      @click="$emit('trigger')"
    >
      <Spinner v-if="triggering" />
      <RefreshCw v-else class="size-4" />
      {{ $t("settings.scan_now") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Loader2, RefreshCw } from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { formatRelativeTime } from "@/helpers/utils";

interface ScannerStatus {
  running: boolean;
  last_scan_time: number;
  last_scan_ago_seconds: number | null;
  last_scan_mapped: number | null;
}

interface Props {
  status: ScannerStatus | null;
  triggering: boolean;
}

const props = defineProps<Props>();
defineEmits<{ trigger: [] }>();

const { t } = useI18n();

const lastScanDisplay = computed(() => {
  if (!props.status) return "...";
  if (
    props.status.last_scan_ago_seconds === null ||
    !props.status.last_scan_time
  ) {
    return t("settings.scan_never");
  }
  return t("settings.scan_ago", [
    formatRelativeTime(props.status.last_scan_ago_seconds),
  ]);
});
</script>
