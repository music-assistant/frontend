<template>
  <Dialog :key="dialogKey" v-model:open="showDialog">
    <DialogContent
      class="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-4 sm:max-w-[560px]"
    >
      <DialogTitle class="sr-only">
        {{ $t("share.preview_title", { title: preview?.title ?? "" }) }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        {{ $t("share.preview_description") }}
      </DialogDescription>
      <div
        v-if="loading"
        class="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <LoaderCircle class="size-4 animate-spin" />
        {{ $t("share.preview_loading") }}
      </div>
      <template v-else-if="preview">
        <ShareArtworkPreview
          :title="preview.title"
          :artist="preview.artist"
          :album="preview.album"
          :art="preview.art"
          :share-url="shareUrl"
          @copy-share-link="copyShareUrl"
        />

        <ShareProviderLinkList :links="preview.links" @copy-link="copyText" />

        <div class="mt-3 flex-none">
          <Button
            variant="outline"
            size="sm"
            :disabled="!shareUrl"
            @click="copyAllLinks"
          >
            <Copy class="size-4" />
            {{ $t("share.copy_all") }}
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import ShareArtworkPreview from "@/components/share/ShareArtworkPreview.vue";
import ShareProviderLinkList from "@/components/share/ShareProviderLinkList.vue";
import { decodeSharePreview, type SharePreview } from "@/helpers/share_links";
import { copyToClipboard } from "@/helpers/utils";
import api, { ApiCommandError } from "@/plugins/api";
import { eventbus, type ShareLinkPreviewEvent } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Copy, LoaderCircle } from "@lucide/vue";

const showDialog = ref(false);
const dialogKey = ref(0);
const loading = ref(false);
const shareUrl = ref("");
const preview = ref<SharePreview>();
let requestId = 0;
let copyRequestId = 0;
let dialogActiveBeforeOpen = false;

watch(showDialog, (open) => {
  if (open) dialogActiveBeforeOpen = store.dialogActive;
  if (!open) copyRequestId++;
  store.dialogActive = open || (dialogActiveBeforeOpen && store.dialogActive);
});

onMounted(() => {
  eventbus.on("shareLinkPreview", (event: ShareLinkPreviewEvent) => {
    dialogKey.value++;
    copyRequestId++;
    showDialog.value = true;
    void loadSharePreview(event.uri);
  });
});

onBeforeUnmount(() => {
  eventbus.off("shareLinkPreview");
  requestId++;
  copyRequestId++;
  if (showDialog.value) {
    store.dialogActive = dialogActiveBeforeOpen && store.dialogActive;
  }
});

async function loadSharePreview(uri: string): Promise<void> {
  const currentRequest = ++requestId;
  loading.value = true;
  shareUrl.value = "";
  preview.value = undefined;

  try {
    const url = await api.generateShareLink(uri);
    if (currentRequest !== requestId) return;
    shareUrl.value = url;
    preview.value = decodeSharePreview(url, (domain) =>
      api.getProviderName(domain),
    );
  } catch (error) {
    if (currentRequest === requestId) {
      showDialog.value = false;
      toast.error(
        error instanceof ApiCommandError && error.details
          ? error.details
          : $t("share.preview_failed"),
      );
    }
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

async function copyText(value: string): Promise<void> {
  if (!value || !showDialog.value) return;
  const currentCopyRequest = ++copyRequestId;
  const isCurrentCopyRequest = () =>
    currentCopyRequest === copyRequestId && showDialog.value;
  try {
    if (!(await copyToClipboard(value))) {
      if (!isCurrentCopyRequest()) return;
      toast.error($t("share.link_copy_failed"));
      return;
    }
    if (!isCurrentCopyRequest()) return;
    toast.success($t("share.link_copied"));
    showDialog.value = false;
  } catch {
    if (!isCurrentCopyRequest()) return;
    toast.error($t("share.link_copy_failed"));
  }
}

async function copyAllLinks(): Promise<void> {
  if (!shareUrl.value || !preview.value) return;
  const lines = [
    `${$t("share.title")}: ${shareUrl.value}`,
    ...preview.value.links.map((link) => `${link.name}: ${link.url}`),
  ];
  await copyText(lines.join("\n"));
}

async function copyShareUrl(): Promise<void> {
  await copyText(shareUrl.value);
}
</script>
