<template>
  <Avatar :class="cn('size-8', props.class)">
    <AvatarFallback
      class="font-semibold"
      :style="{ backgroundColor: style.background, color: style.color }"
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
