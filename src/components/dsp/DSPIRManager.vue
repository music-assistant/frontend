<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[560px]">
      <DialogHeader class="text-left">
        <DialogTitle class="text-center">
          {{ $t("settings.dsp.convolution.library") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("settings.dsp.convolution.library_help") }}
        </DialogDescription>
      </DialogHeader>

      <div>
        <ul v-if="irs.length" class="flex flex-col">
          <li
            v-for="ir in irs"
            :key="ir.ir_id"
            class="flex items-center gap-2 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ ir.name }}</p>
              <p class="truncate text-xs text-muted-foreground">
                {{ dspIRDetailText(ir) }}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="removingId === ir.ir_id"
              :aria-label="$t('settings.dsp.convolution.remove')"
              @click="removeIR(ir)"
            >
              <Trash2 />
            </Button>
          </li>
        </ul>
        <p v-else class="text-sm text-muted-foreground">
          {{ $t("settings.dsp.convolution.empty") }}
        </p>

        <!-- Upload: pick a file, name it, send it base64 encoded. -->
        <Separator class="my-4" />
        <div class="mb-2 flex items-center gap-2">
          <Button variant="outline" :disabled="uploading" @click="pickFile">
            <FileMusic />
            {{ $t("settings.dsp.convolution.choose_file") }}
          </Button>
          <span class="truncate text-sm text-muted-foreground">
            {{ selectedFile?.name ?? $t("settings.dsp.convolution.no_file") }}
          </span>
        </div>
        <div class="grid gap-1.5">
          <Label for="ir-upload-name">
            {{ $t("settings.dsp.convolution.name") }}
          </Label>
          <Input
            id="ir-upload-name"
            v-model="uploadName"
            :disabled="uploading"
          />
        </div>
        <Alert v-if="uploadError" variant="destructive" class="mt-3">
          <AlertDescription>{{ uploadError }}</AlertDescription>
        </Alert>

        <input
          ref="fileInputRef"
          type="file"
          :accept="IR_FILE_ACCEPT"
          class="hidden"
          :aria-label="$t('settings.dsp.convolution.choose_file')"
          @change="onFileSelected"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="uploading" @click="open = false">
          {{ $t("close") }}
        </Button>
        <Button
          :disabled="!selectedFile || !uploadName.trim() || uploading"
          @click="upload"
        >
          <Spinner v-if="uploading" />
          {{ $t("settings.dsp.convolution.upload") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { FileMusic, Trash2 } from "@lucide/vue";
import { api } from "@/plugins/api";
import type { DSPIRMetadata } from "@/plugins/api/interfaces";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  IR_FILE_ACCEPT,
  MAX_IR_BYTES,
  dspIRDetailText,
  readFileAsBase64,
} from "@/helpers/dspIR";

const { t } = useI18n();

defineProps<{
  irs: DSPIRMetadata[];
}>();

const emit = defineEmits<{
  (e: "uploaded", ir: DSPIRMetadata): void;
  (e: "removed", irId: string): void;
}>();

const open = defineModel<boolean>({ required: true });

const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const uploadName = ref("");
const uploadError = ref("");
const uploading = ref(false);
const removingId = ref<string | null>(null);

watch(open, (isOpen) => {
  if (isOpen) return;
  resetUpload();
});

const pickFile = () => {
  fileInputRef.value?.click();
};

const onFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  // Allow re-picking the same file after a failed upload.
  input.value = "";
  uploadError.value = "";
  if (!file) return;
  if (file.size > MAX_IR_BYTES) {
    selectedFile.value = null;
    uploadError.value = t("settings.dsp.convolution.too_large", [
      Math.round(MAX_IR_BYTES / 1024 / 1024),
    ]);
    return;
  }
  selectedFile.value = file;
  if (!uploadName.value.trim()) {
    uploadName.value = file.name.replace(/\.[^.]+$/, "");
  }
};

const upload = async () => {
  const file = selectedFile.value;
  if (!file || uploading.value) return;
  uploading.value = true;
  uploadError.value = "";
  try {
    const data = await readFileAsBase64(file);
    const ir = await api.uploadDSPIR(uploadName.value.trim(), data);
    resetUpload();
    emit("uploaded", ir);
  } catch (error) {
    // The server explains why (size, invalid base64, not valid audio), and
    // that message is more useful than anything we could write here.
    uploadError.value =
      typeof error === "string"
        ? error
        : ((error as Error)?.message ??
          t("settings.dsp.convolution.upload_failed"));
  } finally {
    uploading.value = false;
  }
};

const removeIR = async (ir: DSPIRMetadata) => {
  if (!confirm(t("settings.dsp.convolution.remove_confirm", [ir.name]))) return;
  removingId.value = ir.ir_id;
  try {
    await api.removeDSPIR(ir.ir_id);
    emit("removed", ir.ir_id);
  } finally {
    removingId.value = null;
  }
};

function resetUpload(): void {
  selectedFile.value = null;
  uploadName.value = "";
  uploadError.value = "";
}
</script>
