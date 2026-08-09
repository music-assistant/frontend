<template>
  <div
    class="host-card ma-tap"
    role="button"
    tabindex="0"
    @click="emit('edit', host.id)"
    @keydown.enter.self="emit('edit', host.id)"
    @keydown.space.self.prevent="emit('edit', host.id)"
  >
    <div class="host-card__art">
      <MicVocal class="host-card__icon" />

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost-icon"
            size="icon-sm"
            class="host-card__menu rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90"
            :aria-label="$t('more_options')"
            @click.stop
          >
            <MoreVertical class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="emit('edit', host.id)">
            {{ $t("providers.ai_radio.hosts.card.edit") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            :disabled="isDeleting"
            @click="onDelete"
          >
            {{ $t("providers.ai_radio.card.delete") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div class="host-card__meta">
      <div class="host-card__title">{{ host.name }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { errorMessage } from "@/helpers/ai_radio";
import type { AIRadioHost } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { MicVocal, MoreVertical } from "@lucide/vue";
import { computed } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{
  host: AIRadioHost;
}>();

const emit = defineEmits<{
  edit: [hostId: string];
}>();

const { deletingHostId, deleteHost } = useHosts();

const isDeleting = computed(() => deletingHostId.value === props.host.id);

function onDelete() {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.ai_radio.confirm.delete_host_title"),
    message: $t("providers.ai_radio.confirm.delete_host"),
    confirmLabel: $t("providers.ai_radio.actions.delete"),
    onConfirm: async () => {
      try {
        await deleteHost(props.host.id);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
  });
}
</script>

<style scoped>
.host-card {
  --host-card-pad: 8px;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: var(--host-card-pad);
  border-radius: var(--host-card-pad);
  color: rgb(var(--v-theme-on-background));
  transition: background 0.15s ease;
}
.host-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.ma-tap:active {
  transform: scale(0.97);
}

.host-card__art {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: var(--host-card-pad);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-on-surface), 0.08);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
.host-card__icon {
  width: 34%;
  height: 34%;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
.host-card__menu {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
}

.host-card__meta {
  position: relative;
  width: 100%;
  margin-top: 10px;
}
.host-card__title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
