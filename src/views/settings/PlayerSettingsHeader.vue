<template>
  <Card class="mb-4 gap-0 py-0">
    <CardHeader class="relative flex flex-col gap-5 p-6 pr-16 sm:flex-row">
      <div
        class="flex size-14 shrink-0 items-center justify-center rounded-xl bg-current/10 text-primary"
      >
        <PlayerIcon :icon="player?.icon" :size="32" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-xl leading-tight font-semibold">
            {{ getPlayerName(config) }}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            class="opacity-60 transition-opacity hover:opacity-100"
            :title="$t('settings.player_name')"
            @click="emit('rename')"
          >
            <Pencil class="size-4" />
            <span class="sr-only">{{ $t("settings.player_name") }}</span>
          </Button>
        </div>
        <p
          v-if="summary"
          data-testid="player-summary"
          class="mt-1 text-sm text-muted-foreground"
        >
          {{ summary }}
        </p>
        <div
          v-if="player?.output_protocols.length"
          class="mt-3 flex flex-wrap gap-1"
        >
          <ProtocolChip
            v-for="protocol in player.output_protocols"
            :key="protocol.output_protocol_id"
            :protocol="protocol"
            link-to-docs
          />
        </div>
        <Collapsible v-slot="{ open }" class="mt-3">
          <CollapsibleTrigger as-child>
            <Button
              data-testid="player-details-toggle"
              variant="ghost"
              size="xs"
              class="-ml-2 text-muted-foreground"
            >
              {{ $t("details") }}
              <ChevronDown
                class="size-3.5 transition-transform"
                :class="{ 'rotate-180': open }"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <dl
              data-testid="player-details"
              class="mt-2 grid grid-cols-[max-content_minmax(0,max-content)] items-center gap-x-4 gap-y-1 text-sm"
            >
              <div
                v-for="detail in details"
                :key="detail.label"
                class="contents"
              >
                <dt class="text-muted-foreground">{{ detail.label }}</dt>
                <dd class="m-0 flex min-w-0 items-center gap-2">
                  <span class="min-w-0 font-mono text-xs break-all">
                    {{ detail.value }}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="shrink-0 text-muted-foreground"
                    :aria-label="
                      $t('settings.player_details.copy', [detail.label])
                    "
                    :title="$t('settings.player_details.copy', [detail.label])"
                    @click="copyDetail(detail)"
                  >
                    <Copy class="size-3.5" />
                  </Button>
                </dd>
              </div>
            </dl>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Button
        data-testid="player-menu"
        variant="ghost"
        size="icon-sm"
        class="absolute top-4 right-4"
        aria-haspopup="menu"
        :aria-label="$t('more_options')"
        @click="emit('openMenu', $event)"
      >
        <MoreVertical class="size-4" />
      </Button>
    </CardHeader>
    <CardContent
      class="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4"
    >
      <Button
        v-if="setupLabel"
        data-testid="player-setup"
        :variant="setupLabel === 'configure_player' ? 'default' : 'outline'"
        @click="emit('setup')"
      >
        <RefreshCw class="size-4" />
        {{ $t(setupLabel) }}
      </Button>
      <Button
        as="a"
        data-testid="player-documentation"
        variant="outline"
        :href="documentationUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <BookOpen class="size-4" />
        {{ $t("settings.documentation") }}
      </Button>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { toast } from "vue-sonner";
import PlayerIcon from "@/components/PlayerIcon.vue";
import ProtocolChip from "@/components/ProtocolChip.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getPlayerName } from "@/helpers/player_config";
import { getPlayerTypeLabel } from "@/helpers/players";
import { copyToClipboard, getExternalLinkUrl } from "@/helpers/utils";
import {
  IdentifierType,
  type Player,
  type PlayerConfig,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  BookOpen,
  ChevronDown,
  Copy,
  MoreVertical,
  Pencil,
  RefreshCw,
} from "@lucide/vue";

interface PlayerDetail {
  label: string;
  value: string;
}

const PLAYER_DOCS_URL =
  "https://music-assistant.io/settings/individual-player/";

/**
 * Header card of the settings page of a player: it names the player and carries the
 * actions that act on the player as a whole.
 */
const props = defineProps<{
  config: PlayerConfig;
  /** The live state of the player, absent while the server does not know it. */
  player?: Player;
  /** The setup the player offers; without one no setup action shows. */
  setupLabel?: "configure_player" | "reconfigure_player";
}>();

const emit = defineEmits<{
  rename: [];
  openMenu: [evt: MouseEvent];
  setup: [];
}>();

// the docs of a beta server live on the beta site
const documentationUrl = computed(() => getExternalLinkUrl(PLAYER_DOCS_URL));

const summary = computed(() => {
  if (!props.player) return "";
  const { manufacturer, model } = props.player.device_info;
  const device = [manufacturer, model].filter(Boolean).join(" / ");
  return [device, getPlayerTypeLabel(props.player)].filter(Boolean).join(" · ");
});

const details = computed<PlayerDetail[]>(() => {
  const identifiers = props.player?.device_info.identifiers;
  const items: PlayerDetail[] = [
    { label: $t("settings.player_details.id"), value: props.config.player_id },
    {
      label: $t("settings.player_details.ip_address"),
      value: identifiers?.[IdentifierType.IP_ADDRESS] ?? "",
    },
    {
      label: $t("settings.player_details.mac_address"),
      value: identifiers?.[IdentifierType.MAC_ADDRESS] ?? "",
    },
  ];
  return items.filter((item) => item.value);
});

const copyDetail = async function (detail: PlayerDetail) {
  if (await copyToClipboard(detail.value)) {
    toast.success($t("settings.player_details.copied", [detail.label]));
  } else {
    toast.error($t("settings.player_details.copy_failed", [detail.label]));
  }
};
</script>
