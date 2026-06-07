<template>
  <Card data-test="aa-failures">
    <CardHeader>
      <CardTitle>{{ $t("settings.audio_analysis_failures.title") }}</CardTitle>
      <CardDescription>
        {{ $t("settings.audio_analysis_failures.description") }}
      </CardDescription>
      <CardAction v-if="total > 0">
        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button variant="outline" size="sm" :disabled="clearingAll">
              {{ $t("settings.audio_analysis_failures.clear_all") }}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{ $t("settings.audio_analysis_failures.clear_all_confirm") }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  $t("settings.audio_analysis_failures.clear_all_description", [
                    total,
                  ])
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{{ $t("cancel") }}</AlertDialogCancel>
              <AlertDialogAction @click="onClearAll">
                {{ $t("settings.audio_analysis_failures.clear_all") }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardAction>
    </CardHeader>

    <CardContent>
      <div
        v-if="loading && total === 0"
        class="flex justify-center py-6"
        data-test="aa-failures-loading"
      >
        <Spinner class="size-5" />
      </div>

      <p
        v-else-if="total === 0"
        class="text-muted-foreground text-sm"
        data-test="aa-failures-empty"
      >
        {{ $t("settings.audio_analysis_failures.none") }}
      </p>

      <div v-else class="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader class="bg-muted">
            <TableRow>
              <TableHead>
                {{ $t("settings.audio_analysis_failures.col_item") }}
              </TableHead>
              <TableHead>
                {{ $t("settings.audio_analysis_failures.col_reason") }}
              </TableHead>
              <TableHead>
                {{ $t("settings.audio_analysis_failures.col_retry") }}
              </TableHead>
              <TableHead class="w-0 text-right">
                <span class="sr-only">
                  {{ $t("settings.audio_analysis_failures.col_actions") }}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in pageRows"
              :key="rowId(row)"
              data-test="aa-failure-row"
            >
              <TableCell>
                <div class="font-medium">{{ row.name }}</div>
                <div class="text-muted-foreground font-mono text-xs">
                  <span v-if="row.artist">{{ row.artist }} · </span>
                  {{ row.provider }} · {{ row.itemId }}
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground">{{
                row.reason
              }}</TableCell>
              <TableCell>
                <Badge :variant="retryVariant(row)" class="tabular-nums">
                  {{ retryLabel(row) }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :disabled="pendingKey === rowId(row)"
                  :aria-label="$t('settings.audio_analysis_failures.delete')"
                  :title="$t('settings.audio_analysis_failures.delete')"
                  @click="onClearOne(row)"
                >
                  <Spinner v-if="pendingKey === rowId(row)" class="size-3.5" />
                  <Trash2 v-else class="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <TablePagination
          v-if="pageCount > 1"
          :info="$t('settings.audio_analysis_failures.count', [total])"
          :page="page"
          :total-pages="pageCount"
          :has-next-page="hasNextPage"
          @prev="prev"
          @next="next"
        />
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import {
  classifyRetry,
  rowId,
  useAudioAnalysisFailures,
  type FailureRow,
} from "@/composables/useAudioAnalysisFailures";
import { formatRelativeTime } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { api } from "@/plugins/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { Trash2 } from "lucide-vue-next";
import { onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

const {
  pageRows,
  total,
  page,
  pageCount,
  hasNextPage,
  loading,
  refresh,
  next,
  prev,
  clearOne,
  clearAll,
} = useAudioAnalysisFailures();

const pendingKey = ref<string | null>(null);
const clearingAll = ref(false);

function retryVariant(row: FailureRow): "warning" | "secondary" | "outline" {
  const status = classifyRetry(row.nextRetry, Math.floor(Date.now() / 1000));
  if (status.kind === "blocked") return "warning";
  if (status.kind === "eligible") return "secondary";
  return "outline";
}

function retryLabel(row: FailureRow): string {
  const status = classifyRetry(row.nextRetry, Math.floor(Date.now() / 1000));
  if (status.kind === "blocked")
    return $t("settings.audio_analysis_failures.retry_blocked");
  if (status.kind === "eligible")
    return $t("settings.audio_analysis_failures.retry_eligible");
  return $t("settings.audio_analysis_failures.retry_in", [
    formatRelativeTime(status.seconds),
  ]);
}

async function onClearOne(row: FailureRow): Promise<void> {
  pendingKey.value = rowId(row);
  try {
    await clearOne(row);
    toast.success($t("settings.audio_analysis_failures.cleared_one"));
  } catch {
    toast.error($t("settings.audio_analysis_failures.clear_error"));
  } finally {
    pendingKey.value = null;
  }
}

async function onClearAll(): Promise<void> {
  clearingAll.value = true;
  try {
    const count = await clearAll();
    toast.success($t("settings.audio_analysis_failures.cleared_many", [count]));
  } catch {
    toast.error($t("settings.audio_analysis_failures.clear_error"));
  } finally {
    clearingAll.value = false;
  }
}

onMounted(() => {
  refresh();
});

watch(
  () => api.providers,
  () => {
    refresh();
  },
);
</script>
