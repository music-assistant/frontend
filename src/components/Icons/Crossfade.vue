<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 504.69 310.22"
    :fill="
      darkMode ? ($vuetify.theme.current.dark ? lightColor : darkColor) : ''
    "
  >
    <g>
      <path
        d="M109.67,7.25H0V61.12H87.36l67.42,67.41,38.09-38.08L109.67,7.25Z"
      />
      <path
        d="M504.44,310.22l-106.28-106.8v52.94h-39.36l-72.12-72.12-38.1,38.08,87.9,87.9h167.96Z"
      />
      <path
        d="M504.69,0l-168.21,.34L87.37,249.45H0v53.87H109.68L358.8,54.2l39.63-.02v52.1L504.69,0Z"
      />
    </g>
  </svg>
</template>

<script lang="ts">
export default {
  props: {
    darkMode: {
      type: Boolean,
      required: false,
      default: false,
    },
    darkColor: {
      type: String,
      required: false,
      default: '#000',
    },
    lightColor: {
      type: String,
      required: false,
      default: '#fff',
    },
  },
};
</script>
