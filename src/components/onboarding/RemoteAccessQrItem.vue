<template>
  <!-- scanning the screen you are holding does not help, so a phone goes
       without it and keeps the copy button -->
  <Item
    v-if="!failed"
    size="sm"
    class="max-sm:hidden"
    data-testid="onboarding-remote-access-qr"
  >
    <!-- centred, as it is taller than the text beside it -->
    <ItemMedia
      class="rounded-md bg-white p-1.5 group-has-[[data-slot=item-description]]/item:translate-y-0 group-has-[[data-slot=item-description]]/item:self-center"
    >
      <canvas
        ref="canvas"
        class="block"
        role="img"
        :aria-label="$t('settings.remote_access_qr_code')"
      ></canvas>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ $t("settings.remote_access_qr_code") }}</ItemTitle>
      <ItemDescription>
        {{ $t("settings.remote_access_qr_code_description") }}
      </ItemDescription>
    </ItemContent>
  </Item>
</template>

<script setup lang="ts">
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { renderQrCode } from "@/helpers/qr";
import { remoteAccessLink } from "@/helpers/remote_access";
import { $t } from "@/plugins/i18n";
import { ref, watch } from "vue";

const QR_SIZE = 112;

const props = defineProps<{
  remoteId: string;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const failed = ref(false);

watch(
  [canvas, () => props.remoteId],
  async ([target, remoteId]) => {
    if (!target) return;
    try {
      await renderQrCode(target, remoteAccessLink(remoteId), QR_SIZE);
    } catch {
      failed.value = true;
    }
  },
  { immediate: true },
);
</script>
