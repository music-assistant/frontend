<template>
  <section class="p-4">
    <SettingsHeaderCard
      :icon="Cast"
      :title="$t('settings.category.protocol_settings')"
      :description="playerName"
      :documentation-url="documentationUrl"
      :reset-disabled="!config?.enabled"
      @reset-to-defaults="resetToDefaults"
    />

    <edit-config
      v-if="config"
      ref="editConfig"
      :disabled="!config.enabled"
      :config-entries="configEntries"
      :output-protocols="player?.output_protocols || []"
      :output-menu-items="getOutputMenu"
      :multi-channel="isMultiChannel"
      @submit="onSubmit"
      @action="onAction"
      @immediate-apply="onImmediateApply"
    />

    <!-- z-index clears the player bar (2001), which floats above page content -->
    <div
      v-if="loading"
      data-testid="loading-overlay"
      class="fixed inset-0 z-[2100] flex items-center justify-center bg-background/80"
    >
      <Spinner class="size-16" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Spinner } from "@/components/ui/spinner";
import { useMultiChannelCandidates } from "@/composables/settings/players/useMultiChannelCandidates";
import { usePlayerConfig } from "@/composables/settings/players/usePlayerConfig";
import { goBack } from "@/helpers/navigation";
import { getPlayerConfigPage, getPlayerName } from "@/helpers/player_config";
import { getOutputMenuItems } from "@/helpers/player_settings_actions";
import { getExternalLinkUrl } from "@/helpers/utils";
import {
  ConfigValueType,
  OutputProtocol,
  PlayerType,
} from "@/plugins/api/interfaces";
import { Cast } from "@lucide/vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import EditConfig from "./EditConfig.vue";
import SettingsHeaderCard from "./SettingsHeaderCard.vue";

const OUTPUTS_DOCS_URL =
  "https://music-assistant.io/settings/individual-player/#output-protocols";

// global refs
const router = useRouter();
const editConfig = ref<InstanceType<typeof EditConfig>>();

// props
const props = defineProps<{
  playerId: string;
}>();

const {
  config,
  player,
  loading,
  reloadConfig,
  save,
  onImmediateApply,
  onAction,
} = usePlayerConfig(() => props.playerId, editConfig, {
  // the player is gone, and with it the settings this page shows
  onRemoved: () => {
    editConfig.value?.discardChanges();
    router.replace({ name: "playersettings" });
  },
});

// computed properties
const { candidates: multiChannelCandidates, layouts: multiChannelLayouts } =
  useMultiChannelCandidates(player);

const isMultiChannel = computed(
  () => player.value?.type === PlayerType.MULTI_CHANNEL,
);

const configEntries = computed(() => {
  const shownPlayer = player.value;
  if (!config.value || !shownPlayer) return [];
  return Object.values(config.value.values).filter(
    (entry) => getPlayerConfigPage(entry, shownPlayer) === "outputs",
  );
});

const playerName = computed(() =>
  config.value ? getPlayerName(config.value) : undefined,
);

// the docs of a beta server live on the beta site
const documentationUrl = computed(() => getExternalLinkUrl(OUTPUTS_DOCS_URL));

// methods
const resetToDefaults = function () {
  editConfig.value?.resetToDefaults();
};

const getOutputMenu = function (output: OutputProtocol) {
  if (!config.value) return [];
  return getOutputMenuItems(config.value, output, {
    multiChannelCandidates: multiChannelCandidates.value,
    multiChannelLayouts: multiChannelLayouts.value,
    // the server reset the choices that named the output that went, so the
    // form starts over from what is stored
    onSplitOff: reloadConfig,
    // the output moved into the new player, and this player may be gone with it
    onMultiChannelCreated: (playerId) => {
      editConfig.value?.discardChanges();
      router.replace(`/settings/editplayer/${playerId}`);
    },
  });
};

const onSubmit = async function (values: Record<string, ConfigValueType>) {
  if (await save(values)) {
    goBack(router, {
      name: "editplayer",
      params: { playerId: props.playerId },
    });
  }
};
</script>
