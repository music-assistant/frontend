<template>
  <Card>
    <CardHeader class="items-center text-center">
      <span
        class="bg-destructive/10 text-destructive grid size-12 place-items-center rounded-full"
      >
        <TriangleAlert class="size-6" />
      </span>
      <CardTitle>{{ $t("providers.music_quiz.unsupported_title") }}</CardTitle>
      <CardDescription>
        {{ $t("providers.music_quiz.unsupported_description") }}
      </CardDescription>
    </CardHeader>
    <CardFooter v-if="canEndGame" class="justify-center">
      <Button
        type="button"
        variant="outline"
        :disabled="busy"
        @click="emit('endGame')"
      >
        <Trash2 class="size-4" />
        {{ $t("providers.music_quiz.end_game") }}
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { $t } from "@/plugins/i18n";
import { Trash2, TriangleAlert } from "@lucide/vue";

withDefaults(defineProps<{ canEndGame?: boolean; busy?: boolean }>(), {
  canEndGame: false,
  busy: false,
});
const emit = defineEmits<{ endGame: [] }>();
</script>
