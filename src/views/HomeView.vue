<template>
  <div class="ed-discover">
    <Toolbar
      :is-discover-page="true"
      :icon="Compass"
      color="background"
      :title="$t('discover')"
      show-search
    >
      <template #append>
        <Button
          variant="ghost"
          size="icon"
          :class="editMode ? 'text-primary' : 'opacity-80'"
          :title="
            $t(editMode ? 'homescreen_edit_disable' : 'homescreen_edit_enable')
          "
          :aria-label="
            $t(editMode ? 'homescreen_edit_disable' : 'homescreen_edit_enable')
          "
          @click="handleHomescreenEditToggle"
        >
          <SquarePen class="size-5" />
        </Button>
      </template>
    </Toolbar>

    <!-- Provider error warning banner: message on the left, actions pinned
         right so the bar never reads as empty on wide screens. -->
    <Alert
      v-if="hasProviderErrors && showProviderWarning"
      variant="destructive"
      class="provider-alert mx-7 mb-6 mt-4 flex w-auto items-center gap-3 bg-destructive/8 py-3 pl-4 pr-3 [&>svg]:translate-y-0"
    >
      <CircleAlert class="size-5 shrink-0" />
      <AlertDescription class="min-w-0 flex-1 text-destructive">
        {{ $t("settings.provider_requires_attention_detail") }}
      </AlertDescription>
      <Button
        variant="destructive"
        size="sm"
        class="shrink-0"
        @click="navigateToProviders"
      >
        {{ $t("settings.fix_now") }}
        <ArrowRight class="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        :aria-label="$t('close')"
        @click="showProviderWarning = false"
      >
        <X class="size-4" />
      </Button>
    </Alert>

    <HomeWidgetRows :edit-mode="editMode" />

    <!-- Floating exit button while editing the home screen -->
    <Button
      v-if="editMode"
      class="ed-edit-done"
      @click="handleHomescreenEditToggle"
    >
      <Check class="size-4" />
      {{ $t("homescreen_edit_disable") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import HomeWidgetRows from "@/components/HomeWidgetRows.vue";
import Toolbar from "@/components/Toolbar.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Compass,
  SquarePen,
  X,
} from "@lucide/vue";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const editMode = ref(false);
const hasProviderErrors = ref(false);
const showProviderWarning = ref(true);
const erroredProviderType = ref<string | null>(null);

const handleHomescreenEditToggle = () => {
  editMode.value = !editMode.value;
};

const navigateToProviders = () => {
  if (erroredProviderType.value) {
    router.push({
      name: "providersettings",
      query: { types: erroredProviderType.value },
    });
  } else {
    router.push({ name: "settings" });
  }
};

onMounted(async () => {
  if (authManager.isAdmin()) {
    try {
      const configs = await api.getProviderConfigs();
      const firstError = configs.find(
        (config) => config.enabled && config.last_error,
      );
      hasProviderErrors.value = !!firstError;
      erroredProviderType.value = firstError?.type ?? null;
    } catch {
      // Ignore errors - this is a best-effort feature
    }
  }
});
</script>

<style scoped>
.provider-alert {
  border-color: var(--destructive) !important;
}

.ed-discover {
  background:
    radial-gradient(
      1200px 600px at 20% -10%,
      rgba(var(--v-theme-primary), 0.1),
      transparent 60%
    ),
    rgb(var(--v-theme-background));
  min-height: 100%;
}

.ed-edit-done {
  position: fixed;
  right: calc(24px + var(--device-inset-right));
  top: calc(24px + var(--device-inset-top));
  /* Only has to clear the drag ghost in HomeWidgetRows, so it stays out of the
     global stacking scale and below the player bar and its backdrops. */
  z-index: 60;
  /* Outweighs the equally-!important radius the button's own variants carry. */
  border-radius: 999px !important;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}
</style>
