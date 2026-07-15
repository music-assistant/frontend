<template>
  <ButtonGroup>
    <Button
      type="button"
      :variant="variant"
      data-testid="invitation-share-primary"
      :disabled="sharing || !joinLink"
      @click="nativeShareAvailable ? shareInvitation() : copyLink()"
    >
      <LoaderCircle v-if="sharing" class="size-4 animate-spin" />
      <Share2 v-else-if="nativeShareAvailable" class="size-4" />
      <Check v-else-if="copied" class="size-4" />
      <Copy v-else class="size-4" />
      {{ nativeShareAvailable ? shareLabel : copied ? copiedLabel : copyLabel }}
    </Button>
    <DropdownMenu v-if="nativeShareAvailable">
      <DropdownMenuTrigger as-child>
        <Button
          type="button"
          :variant="variant"
          size="icon"
          data-testid="invitation-share-menu"
          :aria-label="moreOptionsLabel"
          :disabled="sharing || !joinLink"
        >
          <ChevronDown class="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem data-testid="invitation-share-copy" @click="copyLink">
          <Copy class="size-4" />
          {{ copyLabel }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </ButtonGroup>
</template>

<script setup lang="ts">
import { Button, type ButtonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createInvitationFile } from "@/helpers/invitation_share";
import { copyToClipboard } from "@/helpers/utils";
import { Check, ChevronDown, Copy, LoaderCircle, Share2 } from "@lucide/vue";
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { toast } from "vue-sonner";

const COPY_RESET_MS = 1600;
const logoUrl = new URL("@/assets/logo/logo.png", import.meta.url).href;

const props = withDefaults(
  defineProps<{
    copyFailedMessage?: string;
    copyLabel: string;
    copiedLabel: string;
    description: string;
    joinLink: string;
    moreOptionsLabel: string;
    shareFailedMessage: string;
    shareLabel: string;
    title: string;
    variant?: ButtonVariants["variant"];
  }>(),
  {
    copyFailedMessage: undefined,
    variant: "outline",
  },
);

const emit = defineEmits<{ copied: [success: boolean] }>();

const copied = ref(false);
const nativeShareAvailable = ref(false);
const sharing = ref(false);
const invitationFile = shallowRef<File | null>(null);
let copiedTimeout: ReturnType<typeof setTimeout> | undefined;
let invitationGeneration = 0;

async function copyLink() {
  if (!props.joinLink) return;
  const success = await copyToClipboard(props.joinLink);
  copied.value = success;
  emit("copied", success);
  if (!success) {
    if (props.copyFailedMessage) toast.error(props.copyFailedMessage);
    return;
  }

  if (copiedTimeout) clearTimeout(copiedTimeout);
  copiedTimeout = setTimeout(() => {
    copied.value = false;
  }, COPY_RESET_MS);
}

async function shareInvitation() {
  const share = navigator.share;
  if (typeof share !== "function" || !props.joinLink) {
    await copyLink();
    return;
  }

  const shareData: ShareData = {
    title: props.title,
    text: props.description,
    url: props.joinLink,
  };
  const file = invitationFile.value;
  if (file) {
    const richShareData = { ...shareData, files: [file] };
    if (canShare(richShareData)) shareData.files = [file];
  }

  sharing.value = true;
  try {
    await share.call(navigator, shareData);
  } catch (error) {
    if (isShareCancellation(error)) return;
    console.error("Failed to share invitation:", error);
    toast.error(props.shareFailedMessage);
  } finally {
    sharing.value = false;
  }
}

watch(
  () => [props.joinLink, props.title, props.description],
  () => void prepareInvitationFile(),
);

onMounted(() => {
  nativeShareAvailable.value = typeof navigator.share === "function";
  void prepareInvitationFile();
});

onBeforeUnmount(() => {
  invitationGeneration++;
  if (copiedTimeout) clearTimeout(copiedTimeout);
});

defineExpose({ copyLink });

async function prepareInvitationFile() {
  const generation = ++invitationGeneration;
  invitationFile.value = null;
  if (!props.joinLink || !supportsFileSharing()) return;

  try {
    const file = await createInvitationFile({
      description: props.description,
      joinLink: props.joinLink,
      logoUrl,
      title: props.title,
    });
    if (generation === invitationGeneration) {
      invitationFile.value = file;
    }
  } catch (error) {
    if (generation === invitationGeneration) {
      console.error("Failed to create invitation image:", error);
    }
  }
}

function supportsFileSharing() {
  if (
    !nativeShareAvailable.value ||
    typeof navigator.canShare !== "function" ||
    typeof File !== "function"
  ) {
    return false;
  }

  const testFile = new File([""], "music-assistant-invitation.png", {
    type: "image/png",
  });
  return canShare({ files: [testFile] });
}

function canShare(data: ShareData) {
  try {
    return navigator.canShare?.(data) ?? false;
  } catch (error) {
    console.error("Failed to check native share support:", error);
    return false;
  }
}

function isShareCancellation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}
</script>
