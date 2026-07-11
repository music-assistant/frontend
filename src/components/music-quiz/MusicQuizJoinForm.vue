<template>
  <form
    class="flex flex-col gap-4"
    :aria-label="$t('providers.music_quiz.join') + ' ' + sessionName"
    @submit.prevent="submit"
  >
    <Field>
      <FieldLabel for="music-quiz-player-name">
        {{ $t("providers.music_quiz.player_name") }}
      </FieldLabel>
      <Input
        id="music-quiz-player-name"
        ref="nameInput"
        v-model="playerName"
        autocomplete="nickname"
        autocapitalize="words"
        enterkeyhint="done"
        :placeholder="$t('providers.music_quiz.enter_name')"
      />
    </Field>
    <Button type="submit" size="lg" :disabled="busy || !playerName.trim()">
      <LogIn class="size-4" />
      {{ $t("providers.music_quiz.join") }}
    </Button>
  </form>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { $t } from "@/plugins/i18n";
import { LogIn } from "@lucide/vue";
import { nextTick, onMounted, ref } from "vue";

const props = defineProps<{
  sessionName: string;
  busy: boolean;
  initialName?: string;
}>();
const emit = defineEmits<{ join: [name: string] }>();

const playerName = ref(props.initialName ?? "");
const nameInput = ref<InstanceType<typeof Input> | null>(null);

function submit() {
  const trimmed = playerName.value.trim();
  if (!trimmed) return;
  emit("join", trimmed);
}

onMounted(async () => {
  await nextTick();
  nameInput.value?.focus();
});
</script>
