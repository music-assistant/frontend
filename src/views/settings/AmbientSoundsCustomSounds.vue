<!--
  Management card for the ambient sounds provider's user-added custom sounds
  (stream urls). Rendered on that provider's settings page only; the audio
  overlay dialog itself is a pure sound picker.
-->
<template>
  <Card class="mb-4">
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <CardTitle>{{ $t("audio_overlay_custom_sounds") }}</CardTitle>
          <CardDescription class="mt-1">
            {{ $t("audio_overlay_add_custom_explanation") }}
          </CardDescription>
        </div>
        <Button @click="showAddDialog = true">
          <Plus class="size-4" />
          {{ $t("audio_overlay_add_custom") }}
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <div
        v-if="loading && !customSounds.length"
        class="flex justify-center py-6"
      >
        <Spinner />
      </div>
      <div
        v-else-if="!customSounds.length"
        class="py-2 text-sm text-muted-foreground"
      >
        {{ $t("audio_overlay_no_custom_sounds") }}
      </div>
      <div v-else class="flex flex-col divide-y">
        <div
          v-for="sound in customSounds"
          :key="sound.item_id"
          class="flex items-center justify-between gap-3 py-2"
        >
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{{ sound.name }}</div>
            <div class="truncate text-xs text-muted-foreground">
              {{ sound.item_id }}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="$t('remove')"
            @click="onRemoveSound(sound)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>

  <AddAmbientSoundDialog v-model="showAddDialog" />
</template>

<script setup lang="ts">
import { Plus, Trash2 } from "@lucide/vue";
import { onMounted, ref, watch } from "vue";

import AddAmbientSoundDialog from "@/components/AddAmbientSoundDialog.vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/plugins/api";
import type { SoundEffect } from "@/plugins/api/interfaces";

const customSounds = ref<SoundEffect[]>([]);
const loading = ref(false);
const showAddDialog = ref(false);

onMounted(loadCustomSounds);

// refresh after the add dialog closes, whether a sound was added or not
watch(showAddDialog, (open) => {
  if (!open) loadCustomSounds();
});

async function loadCustomSounds(): Promise<void> {
  loading.value = true;
  try {
    const allSounds = await api.getSoundEffects();
    // custom sounds live on the ambient sounds provider with the stream url
    // as item id, unlike the builtin presets which use plain preset ids
    customSounds.value = allSounds.filter(
      (effect) =>
        api.getProvider(effect.provider)?.domain === "ambient_sounds" &&
        effect.item_id.includes("://"),
    );
  } finally {
    loading.value = false;
  }
}

const onRemoveSound = async (sound: SoundEffect) => {
  try {
    await api.removeAmbientSound(sound.item_id);
  } catch (e) {
    // the api plugin already surfaces the failure via the global error toast
    console.error("Failed to remove ambient sound:", e);
  } finally {
    await loadCustomSounds();
  }
};
</script>
