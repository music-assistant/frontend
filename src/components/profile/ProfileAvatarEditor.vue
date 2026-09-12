<script setup lang="ts">
import { Camera, User } from "@lucide/vue";
import { useI18n } from "vue-i18n";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useProfileAvatarEditor } from "@/composables/useProfileAvatarEditor";

const props = withDefaults(
  defineProps<{
    modelValue?: string | null;
    disabled?: boolean;
    avatarClass?: string;
  }>(),
  { modelValue: "", disabled: false, avatarClass: "size-32" },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const { t } = useI18n();
const { openAvatarEditor } = useProfileAvatarEditor();

const openEditor = () => {
  openAvatarEditor(props.modelValue, (avatarUrl) => {
    emit("update:modelValue", avatarUrl);
  });
};
</script>

<template>
  <div class="relative">
    <Avatar :class="avatarClass">
      <AvatarImage v-if="modelValue" :src="modelValue" />
      <AvatarFallback class="bg-muted">
        <User class="size-1/2 text-muted-foreground" />
      </AvatarFallback>
    </Avatar>
    <Button
      v-if="!disabled"
      type="button"
      variant="outline"
      size="icon"
      class="absolute right-0 bottom-0 size-8 rounded-full border-2 border-background bg-background shadow-md hover:bg-accent"
      :aria-label="t('tooltip.change_avatar')"
      @click="openEditor"
    >
      <Camera :size="14" />
    </Button>
  </div>
</template>
