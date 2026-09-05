<script setup lang="ts">
import { Camera, User } from "@lucide/vue";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
const open = ref(false);
const tempAvatarUrl = ref("");

watch(open, (isOpen) => {
  if (isOpen) tempAvatarUrl.value = props.modelValue || "";
});

const save = () => {
  emit("update:modelValue", tempAvatarUrl.value);
  open.value = false;
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
      @click="open = true"
    >
      <Camera :size="14" />
    </Button>
  </div>

  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("auth.change_avatar") }}</DialogTitle>
        <DialogDescription>{{ t("auth.avatar_url_hint") }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col items-center gap-4 py-4">
        <Avatar class="size-36">
          <AvatarImage v-if="tempAvatarUrl" :src="tempAvatarUrl" />
          <AvatarFallback class="bg-muted">
            <User :size="72" class="text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <Field class="w-full">
          <FieldLabel>{{ t("auth.avatar_url") }}</FieldLabel>
          <Input
            v-model="tempAvatarUrl"
            :placeholder="t('auth.avatar_url_hint')"
          />
          <FieldDescription>{{ t("auth.avatar_url_hint") }}</FieldDescription>
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          {{ t("cancel") }}
        </Button>
        <Button @click="save">{{ t("auth.save_changes") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
