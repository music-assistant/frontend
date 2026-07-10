<template>
  <div
    v-if="visible"
    class="listen-in"
    :class="{ 'listen-in--active': isListeningIn }"
  >
    <Headphones :size="20" class="listen-in__icon" />
    <div class="listen-in__text">
      <span class="listen-in__title">{{ title }}</span>
      <span class="listen-in__desc">{{ description }}</span>
    </div>
    <Button
      v-if="mode === 'remote'"
      :variant="isListeningIn ? 'secondary' : 'default'"
      size="sm"
      :disabled="busy"
      class="listen-in__action"
      @click="isListeningIn ? disableListenIn() : enableListenIn()"
    >
      {{
        isListeningIn
          ? $t("providers.party.guest_page.listen_in_stop")
          : $t("providers.party.guest_page.listen_in_tap")
      }}
    </Button>
    <Switch
      v-else
      :model-value="isListeningIn"
      :disabled="busy"
      :aria-label="title"
      class="listen-in__action"
      @update:model-value="onToggle"
    />
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useListenIn } from "@/composables/useListenIn";
import { usePartyConfig } from "@/composables/usePartyConfig";
import { EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { partyListenInEnabled } from "@/plugins/web_player";
import { Headphones } from "@lucide/vue";
import { computed, onBeforeUnmount, watch } from "vue";
import { toast } from "vue-sonner";

const { config } = usePartyConfig();
const mode = computed(() => config.value?.mode);

// A party guest only needs a (receive-only) web player once listen-in is
// enabled; toggle the web player accordingly and release it on teardown.
watch(
  mode,
  (value) => {
    partyListenInEnabled.value = value !== undefined;
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  partyListenInEnabled.value = false;
});

const {
  isListeningIn,
  busy,
  shouldShowListenInToggle,
  enableListenIn,
  disableListenIn,
} = useListenIn({
  domain: "party",
  mode: () => config.value?.mode,
  notifyError: (message) => toast.error(message),
  errorMessages: {
    noWebPlayer: $t("providers.party.guest_page.listen_in_error_no_web_player"),
    listenIn: $t("providers.party.guest_page.listen_in_error_start"),
    stopListenIn: $t("providers.party.guest_page.listen_in_error_stop"),
  },
  recheckEvents: [EventType.PROVIDERS_UPDATED, EventType.QUEUE_UPDATED],
});

// Remote mode keeps the control visible while listening so guests can stop.
const visible = computed(
  () => shouldShowListenInToggle.value || isListeningIn.value,
);

const title = computed(() =>
  isListeningIn.value
    ? $t("providers.party.guest_page.listen_in_active")
    : $t("providers.party.guest_page.listen_in"),
);

const description = computed(() =>
  mode.value === "remote"
    ? $t("providers.party.guest_page.listen_in_remote")
    : $t("providers.party.guest_page.listen_in_venue"),
);

function onToggle(enabled: boolean) {
  if (enabled) enableListenIn();
  else disableListenIn();
}
</script>

<style scoped>
.listen-in {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
  margin-bottom: 1rem;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  flex-shrink: 0;
}

.listen-in--active {
  background: rgba(var(--v-theme-primary), 0.16);
  border-color: rgba(var(--v-theme-primary), 0.4);
}

.listen-in__icon {
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.listen-in__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.listen-in__title {
  font-weight: 600;
  font-size: 0.9rem;
}

.listen-in__desc {
  font-size: 0.78rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.listen-in__action {
  flex-shrink: 0;
}
</style>
