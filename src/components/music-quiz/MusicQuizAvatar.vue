<template>
  <Avatar :class="cn('size-8', props.class)">
    <!-- The fallback's own bg-muted utility wins over an inline colour, so
         the colour goes in through variables these utilities read. -->
    <AvatarFallback
      class="bg-(--quiz-avatar-bg) text-(--quiz-avatar-fg) font-semibold"
      :style="{
        '--quiz-avatar-bg': style.background,
        '--quiz-avatar-fg': style.color,
      }"
    >
      {{ initials }}
    </AvatarFallback>
  </Avatar>
</template>

<script setup lang="ts">
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getMusicQuizAvatarInitials,
  getMusicQuizAvatarStyle,
} from "@/helpers/music_quiz_avatar";
import { cn } from "@/lib/utils";
import { computed, type HTMLAttributes } from "vue";

const props = defineProps<{
  name: string;
  class?: HTMLAttributes["class"];
}>();

const initials = computed(() => getMusicQuizAvatarInitials(props.name));
const style = computed(() => getMusicQuizAvatarStyle(props.name));
</script>
