<template>
  <Card class="items-center gap-4 py-6 text-center">
    <CardContent class="flex flex-col items-center gap-3 px-6">
      <p v-if="caption" class="text-muted-foreground text-sm font-medium">
        {{ caption }}
      </p>
      <div class="rounded-xl bg-white p-3">
        <canvas
          ref="qrCanvas"
          role="img"
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
      <InvitationShareActions
        :join-link="joinLink"
        :title="$t('providers.music_quiz.share_title')"
        :description="$t('providers.music_quiz.share_description')"
        :copy-label="$t('providers.music_quiz.copy_link')"
        :copied-label="$t('providers.music_quiz.copied')"
        :copy-failed-message="$t('providers.music_quiz.copy_join_link_failed')"
        :more-options-label="$t('providers.music_quiz.more_share_options')"
        :share-label="$t('providers.music_quiz.share_invitation')"
        :share-failed-message="$t('providers.music_quiz.share_failed')"
      />
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import InvitationShareActions from "@/components/InvitationShareActions.vue";
import { Card, CardContent } from "@/components/ui/card";
import { renderQrCode } from "@/helpers/qr";
import { $t } from "@/plugins/i18n";
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    joinLink: string;
    size?: number;
    caption?: string;
  }>(),
  { size: 220, caption: undefined },
);

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const qrError = ref(false);

async function renderQr() {
  if (!qrCanvas.value || !props.joinLink) return;
  try {
    await renderQrCode(qrCanvas.value, props.joinLink, props.size);
    qrError.value = false;
  } catch (err) {
    console.error("Could not render Music Quiz join QR", err);
    qrError.value = true;
  }
}

watch([qrCanvas, () => props.joinLink, () => props.size], () => renderQr(), {
  immediate: true,
});
</script>
