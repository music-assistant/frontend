<template>
  <Card class="items-center gap-4 py-6 text-center">
    <CardContent class="flex flex-col items-center gap-3 px-6">
      <p v-if="caption" class="text-muted-foreground text-sm font-medium">
        {{ caption }}
      </p>
      <div class="rounded-xl bg-white p-3">
        <canvas
          ref="qrCanvas"
          :aria-label="$t('providers.music_quiz.invite_players')"
        ></canvas>
      </div>
      <p
        v-if="qrError"
        class="text-muted-foreground max-w-56 text-sm"
        role="alert"
      >
        {{ $t("providers.music_quiz.qr_unavailable") }}
      </p>
      <Button type="button" variant="outline" @click="copyLink">
        <Copy v-if="!copied" class="size-4" />
        <Check v-else class="size-4" />
        {{
          copied
            ? $t("providers.music_quiz.copied")
            : $t("providers.music_quiz.copy_link")
        }}
      </Button>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { renderMusicAssistantQr } from "@/helpers/branded_qr";
import { copyToClipboard } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { Check, Copy } from "@lucide/vue";
import { onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";

const COPIED_RESET_MS = 1600;

const props = withDefaults(
  defineProps<{
    joinLink: string;
    size?: number;
    caption?: string;
  }>(),
  { size: 220, caption: undefined },
);

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);
const qrError = ref(false);
let copiedTimeout: ReturnType<typeof setTimeout> | undefined;

async function renderQr() {
  if (!qrCanvas.value || !props.joinLink) return;
  try {
    await renderMusicAssistantQr(qrCanvas.value, props.joinLink, props.size);
    qrError.value = false;
  } catch (err) {
    console.error("Could not render Music Quiz join QR", err);
    qrError.value = true;
  }
}

async function copyLink() {
  if (!props.joinLink) return;
  copied.value = await copyToClipboard(props.joinLink);
  if (!copied.value) {
    toast.error($t("providers.music_quiz.copy_join_link_failed"));
    return;
  }
  if (copiedTimeout) clearTimeout(copiedTimeout);
  copiedTimeout = setTimeout(() => {
    copied.value = false;
  }, COPIED_RESET_MS);
}

watch([qrCanvas, () => props.joinLink, () => props.size], () => renderQr(), {
  immediate: true,
});

onBeforeUnmount(() => {
  if (copiedTimeout) clearTimeout(copiedTimeout);
});
</script>
