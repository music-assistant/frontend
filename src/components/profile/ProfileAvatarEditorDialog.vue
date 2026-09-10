<script setup lang="ts">
import { User } from "@lucide/vue";
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSidebar } from "@/components/ui/sidebar";
import { useProfileAvatarEditor } from "@/composables/useProfileAvatarEditor";

const { t } = useI18n();
const { isMobile } = useSidebar();
const {
  avatarEditorError,
  avatarEditorOpen,
  avatarEditorValue,
  closeAvatarEditor,
  saveAvatar,
} = useProfileAvatarEditor();
const tempAvatarUrl = ref("");

watch(avatarEditorOpen, (isOpen) => {
  if (isOpen) tempAvatarUrl.value = avatarEditorValue.value || "";
});

const save = () => saveAvatar(tempAvatarUrl.value);
</script>

<template>
  <component :is="isMobile ? Sheet : Dialog" v-model:open="avatarEditorOpen">
    <component
      :is="isMobile ? SheetContent : DialogContent"
      :class="
        isMobile
          ? 'h-dvh max-h-dvh w-full max-w-none overflow-hidden rounded-t-xl p-4'
          : 'sm:max-w-md'
      "
      :style="isMobile ? 'z-index: 100004 !important' : undefined"
      v-bind="isMobile ? { side: 'bottom', overlayClass: '!z-[100003]' } : {}"
      :overlay-style="isMobile ? 'z-index: 100003 !important' : undefined"
    >
      <component
        :is="isMobile ? SheetHeader : DialogHeader"
        :class="isMobile ? 'px-0 pt-0 pr-10' : undefined"
      >
        <component :is="isMobile ? SheetTitle : DialogTitle">
          {{ t("auth.change_avatar") }}
        </component>
        <component :is="isMobile ? SheetDescription : DialogDescription">
          {{ t("auth.avatar_url_hint") }}
        </component>
      </component>
      <div
        class="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto py-4"
      >
        <Avatar class="size-36 shrink-0">
          <AvatarImage v-if="tempAvatarUrl" :src="tempAvatarUrl" />
          <AvatarFallback class="bg-muted">
            <User class="size-18 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <Field class="w-full">
          <FieldLabel>{{ t("auth.avatar_url") }}</FieldLabel>
          <Input
            v-model="tempAvatarUrl"
            :placeholder="t('auth.avatar_url_hint')"
            autofocus
          />
          <FieldDescription>{{ t("auth.avatar_url_hint") }}</FieldDescription>
        </Field>
        <Alert v-if="avatarEditorError" variant="destructive" class="w-full">
          <AlertDescription>{{ avatarEditorError }}</AlertDescription>
        </Alert>
      </div>
      <component
        :is="isMobile ? SheetFooter : DialogFooter"
        :class="isMobile ? 'p-0' : undefined"
      >
        <Button variant="outline" @click="closeAvatarEditor">
          {{ t("cancel") }}
        </Button>
        <Button @click="save">{{ t("auth.save_changes") }}</Button>
      </component>
    </component>
  </component>
</template>
