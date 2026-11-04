<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>
          {{ $t("bookmark_saved_in", { name: storedIn }) }}
        </DialogDescription>
      </DialogHeader>
      <form id="bookmark-form" class="py-2" @submit.prevent="save">
        <label for="bookmark-name" class="mb-2 block text-sm font-medium">
          {{ $t("bookmark_name") }}
        </label>
        <Input id="bookmark-name" v-model="name" autocomplete="off" autofocus />
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">
          {{ $t("cancel") }}
        </Button>
        <Button type="submit" form="bookmark-form" :disabled="!name.trim()">
          {{ $t("settings.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { store } from "@/plugins/store";
import { onBeforeUnmount, ref, watch } from "vue";

export interface Props {
  title: string;
  initialName: string;
  // the provider, or Music Assistant, that keeps the bookmark
  storedIn: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{ save: [name: string] }>();
const open = defineModel<boolean>("open", { required: true });

const name = ref("");

watch(open, (isOpen) => {
  // the fullscreen player leaves escape to whatever dialog is on top of it
  store.dialogActive = isOpen;
  if (isOpen) name.value = props.initialName;
});

onBeforeUnmount(() => {
  if (open.value) store.dialogActive = false;
});

const save = function () {
  if (!name.value.trim()) return;
  emit("save", name.value.trim());
  open.value = false;
};
</script>
