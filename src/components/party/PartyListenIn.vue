<template>
  <ListenIn
    domain="party"
    :mode="mode"
    :labels="labels"
    :recheck-events="recheckEvents"
  />
</template>

<script setup lang="ts">
import ListenIn, { type ListenInLabels } from "@/components/ListenIn.vue";
import { usePartyConfig } from "@/composables/usePartyConfig";
import { EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { partyListenInEnabled } from "@/plugins/web_player";
import { computed, onBeforeUnmount, watch } from "vue";

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

const recheckEvents = [EventType.PROVIDERS_UPDATED, EventType.QUEUE_UPDATED];

const labels = computed<ListenInLabels>(() => ({
  title: $t("providers.party.guest_page.listen_in"),
  titleActive: $t("providers.party.guest_page.listen_in_active"),
  descriptionVenue: $t("providers.party.guest_page.listen_in_venue"),
  descriptionRemote: $t("providers.party.guest_page.listen_in_remote"),
  tap: $t("providers.party.guest_page.listen_in_tap"),
  stop: $t("providers.party.guest_page.listen_in_stop"),
  poweredBy: $t("providers.party.guest_page.listen_in_powered_by"),
  errorNoWebPlayer: $t(
    "providers.party.guest_page.listen_in_error_no_web_player",
  ),
  errorListenIn: $t("providers.party.guest_page.listen_in_error_start"),
  errorStopListenIn: $t("providers.party.guest_page.listen_in_error_stop"),
}));
</script>
