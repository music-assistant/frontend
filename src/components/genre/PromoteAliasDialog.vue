<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("promote_alias") }}</DialogTitle>
      </DialogHeader>
      <p>{{ $t("confirm_promote_alias", [alias || ""]) }}</p>
      <DialogFooter>
        <Button variant="outline" @click="model = false">
          {{ $t("cancel") }}
        </Button>
        <Button :disabled="loading" @click="promoteAlias">
          {{ $t("promote") }}
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/plugins/api";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

interface Props {
  alias: string | null;
  genreItemId: string;
}

const props = defineProps<Props>();
const model = defineModel<boolean>();

const { t } = useI18n();
const router = useRouter();
const loading = ref(false);

const promoteAlias = async () => {
  if (!props.alias || loading.value) return;

  loading.value = true;
  try {
    const newGenre = await api.promoteGenreAlias(
      props.genreItemId,
      props.alias,
    );
    model.value = false;
    router.push({
      name: "genre",
      params: {
        itemId: newGenre.item_id,
        provider: newGenre.provider,
      },
    });
  } catch (error) {
    toast.error(t("promote_alias_failed"));
  } finally {
    toast.success(t("promote_alias_successfully"));
    loading.value = false;
  }
};
</script>
