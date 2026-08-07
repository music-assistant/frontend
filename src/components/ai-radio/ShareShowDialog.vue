<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{{ $t("providers.ai_radio.share.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.share.description") }}
        </DialogDescription>
      </DialogHeader>

      <div
        class="flex max-h-[60vh] flex-col gap-4 overflow-x-hidden overflow-y-auto -mx-6 px-6 py-1"
      >
        <Alert v-if="lossy" variant="warning">
          <TriangleAlert class="h-4 w-4" />
          <AlertTitle>
            {{ $t("providers.ai_radio.customize.lossy_warning_title") }}
          </AlertTitle>
          <AlertDescription>
            {{ $t("providers.ai_radio.share.lossy_description") }}
          </AlertDescription>
        </Alert>

        <div class="flex flex-col gap-2">
          <Label for="ai-radio-share-json">
            {{ $t("providers.ai_radio.share.json_label") }}
          </Label>
          <Textarea
            id="ai-radio-share-json"
            :model-value="json"
            readonly
            rows="12"
            class="font-mono text-xs"
            @focus="selectAll"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="!json" @click="download">
          <Download class="h-4 w-4" />
          {{ $t("providers.ai_radio.share.download") }}
        </Button>
        <Button :disabled="!json" @click="copy">
          <Copy class="h-4 w-4" />
          {{ $t("providers.ai_radio.share.copy") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  buildSharedShow,
  decompileStation,
  sharedShowFileName,
  sharedShowToJson,
} from "@/helpers/ai_radio";
import { copyToClipboard } from "@/helpers/utils";
import type { AIRadioStation } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Copy, Download, TriangleAlert } from "@lucide/vue";
import { ref, watch } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  station?: AIRadioStation;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { sections, loadSections } = useShows();

const json = ref("");
const lossy = ref(false);

async function buildJson(station: AIRadioStation) {
  if (sections.value.length === 0) {
    await loadSections();
  }
  const decompiled = decompileStation(station, sections.value);
  lossy.value = decompiled.lossy;
  json.value = sharedShowToJson(
    buildSharedShow({
      basics: decompiled.basics,
      segments: decompiled.segments,
    }),
  );
}

/** Selecting on focus makes a manual copy work when the clipboard is unavailable. */
function selectAll(event: FocusEvent) {
  (event.target as HTMLTextAreaElement | null)?.select();
}

async function copy() {
  const success = await copyToClipboard(json.value);
  toast[success ? "success" : "error"](
    $t(
      success
        ? "providers.ai_radio.share.copied"
        : "providers.ai_radio.share.copy_failed",
    ),
  );
}

function download() {
  const blob = new Blob([json.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = sharedShowFileName(props.station?.name || "show");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

watch(
  () => props.open,
  async (isOpen) => {
    store.dialogActive = isOpen;
    if (!isOpen || !props.station) return;
    json.value = "";
    lossy.value = false;
    try {
      await buildJson(props.station);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  },
);
</script>
