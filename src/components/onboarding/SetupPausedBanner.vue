<template>
  <Alert
    v-if="paused"
    role="status"
    class="fixed right-(--device-inset-right) bottom-(--bottom-bars-height) z-2002 m-4 flex w-auto max-w-md items-center gap-3 py-3 pr-3 pl-4 shadow-lg max-sm:left-(--device-inset-left) [&>svg]:translate-y-0"
    data-testid="setup-paused-banner"
  >
    <CirclePause class="size-5 shrink-0" />
    <div class="min-w-0 flex-1">
      <AlertTitle>{{ $t("onboarding.paused_title") }}</AlertTitle>
      <AlertDescription>{{ $t("onboarding.paused_text") }}</AlertDescription>
    </div>
    <Button
      size="sm"
      class="shrink-0"
      data-testid="setup-resume"
      @click="open()"
    >
      {{ $t("onboarding.resume") }}
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      class="shrink-0"
      :aria-label="$t('close')"
      data-testid="setup-paused-dismiss"
      @click="paused = false"
    >
      <X class="size-4" />
    </Button>
  </Alert>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/composables/useOnboarding";
import { $t } from "@/plugins/i18n";
import { CirclePause, X } from "@lucide/vue";

// a paused setup stays offered on every page until it is resumed or dismissed;
// dismissed, it is still picked up again from the settings
const { paused, open } = useOnboarding();
</script>
