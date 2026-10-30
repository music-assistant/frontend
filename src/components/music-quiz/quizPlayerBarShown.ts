import { ref } from "vue";

/**
 * True while the quiz's own player bar is on screen.
 * The app's player bar steps aside only then, so pages without the quiz bar
 * (no game, setup, present mode) keep the normal one.
 */
export const quizPlayerBarShown = ref(false);
