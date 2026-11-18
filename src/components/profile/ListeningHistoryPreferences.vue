<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("listening_history.preferences_title") }}</CardTitle>
      <CardDescription>{{
        $t("listening_history.preferences_description")
      }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div
        v-for="mediaType in mediaTypes"
        :key="mediaType"
        class="flex items-center justify-between gap-4"
      >
        <Label :for="`${id}-${mediaType}`">{{ $t(`${mediaType}s`) }}</Label>
        <Switch
          :id="`${id}-${mediaType}`"
          :model-value="preferences[mediaType] !== false"
          :disabled="saving"
          @update:model-value="(value) => save(mediaType, value)"
        />
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, useId } from "vue";
import { toast } from "vue-sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LISTENING_HISTORY_PREFERENCE } from "@/composables/useItemListeningHistory";
import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import { MediaType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

const mediaTypes = [MediaType.TRACK, MediaType.ALBUM, MediaType.ARTIST];
const id = useId();
const saving = ref(false);
const { getPreference } = useUserPreferences();
const preferences = getPreference<Partial<Record<MediaType, boolean>>>(
  LISTENING_HISTORY_PREFERENCE,
  {},
);
async function save(mediaType: MediaType, value: boolean): Promise<void> {
  saving.value = true;
  try {
    if (
      await setUserPreference(LISTENING_HISTORY_PREFERENCE, {
        ...preferences.value,
        [mediaType]: value,
      })
    ) {
      toast.success($t("listening_history.preferences_saved"));
    } else {
      toast.error($t("listening_history.preferences_failed"));
    }
  } finally {
    saving.value = false;
  }
}
</script>
