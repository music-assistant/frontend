<template>
  <svg
    id="a"
    data-name="Calque 1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 99.74"
  >
    <path
      :fill="
        darkMode ? ($vuetify.theme.current.dark ? lightColor : darkColor) : ''
      "
      d="M50,0c27.61,0,50,22.39,50,50-2.63,66.32-97.38,66.31-100,0C0,22.39,22.39,0,50,0Z"
    />
    <g>
      <path
        :fill="
          darkMode ? ($vuetify.theme.current.dark ? darkColor : lightColor) : ''
        "
        d="M76,50c-1.27-34.48-50.73-34.48-52,0-.14,22.03,26.17,34.04,42.7,19.9l5.9,5.8,3.1-2.9-5.9-5.9c3.9-4.6,6.2-10.5,6.2-16.9Zm-26,20.9c-27.72-1.08-27.72-40.72,0-41.8,17.62-.07,27.22,20.72,16.2,34.1l-4.5-4.6c-2.1-2.45-5.53,.57-3.5,3,0,0,.1,.1,.1,.1l4.8,4.7c-3.6,2.8-8.2,4.5-13.1,4.5Z"
      />
      <path
        :fill="
          darkMode ? ($vuetify.theme.current.dark ? darkColor : lightColor) : ''
        "
        d="M50,41.8c-4.5,0-8.2,3.7-8.2,8.2,.47,10.88,15.99,10.87,16.4,0,0-4.6-3.7-8.2-8.2-8.2Zm0,10c-2.37-.03-2.37-3.57,0-3.6,2.37,.03,2.37,3.57,0,3.6Z"
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
