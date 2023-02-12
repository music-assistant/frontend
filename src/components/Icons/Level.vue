<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 525 507.5"
    :fill="
      darkMode ? ($vuetify.theme.current.dark ? lightColor : darkColor) : ''
    "
  >
    <g id="Layer_2" data-name="Layer 2">
      <g id="Layer_1-2" data-name="Layer 1">
        <path d="M227.5,455h70v17.5h-70Z" />
        <path d="M122.5,455h70v17.5h-70Z" />
        <path d="M17.5,455h70v17.5h-70Z" />
        <path d="M437.5,455h70v17.5h-70Z" />
        <path d="M332.5,455h70v17.5h-70Z" />
        <path d="M227.5,420h70v17.5h-70Z" />
        <path d="M122.5,420h70v17.5h-70Z" />
        <path d="M17.5,420h70v17.5h-70Z" />
        <path d="M437.5,420h70v17.5h-70Z" />
        <path d="M332.5,420h70v17.5h-70Z" />
        <path d="M227.5,385h70v17.5h-70Z" />
        <path d="M122.5,385h70v17.5h-70Z" />
        <path d="M17.5,385h70v17.5h-70Z" />
        <path d="M437.5,385h70v17.5h-70Z" />
        <path d="M332.5,385h70v17.5h-70Z" />
        <path d="M227.5,350h70v17.5h-70Z" />
        <path d="M122.5,350h70v17.5h-70Z" />
        <path d="M17.5,350h70v17.5h-70Z" />
        <path d="M437.5,350h70v17.5h-70Z" />
        <path d="M332.5,350h70v17.5h-70Z" />
        <path d="M122.5,315h70v17.5h-70Z" />
        <path d="M17.5,315h70v17.5h-70Z" />
        <path d="M437.5,315h70v17.5h-70Z" />
        <path d="M332.5,315h70v17.5h-70Z" />
        <path d="M122.5,280h70v17.5h-70Z" />
        <path d="M17.5,280h70v17.5h-70Z" />
        <path d="M437.5,280h70v17.5h-70Z" />
        <path d="M332.5,280h70v17.5h-70Z" />
        <path d="M122.5,245h70v17.5h-70Z" />
        <path d="M437.5,245h70v17.5h-70Z" />
        <path d="M332.5,245h70v17.5h-70Z" />
        <path d="M122.5,210h70v17.5h-70Z" />
        <path d="M437.5,210h70v17.5h-70Z" />
        <path d="M332.5,210h70v17.5h-70Z" />
        <path d="M122.5,175h70v17.5h-70Z" />
        <path d="M332.5,175h70v17.5h-70Z" />
        <path d="M122.5,140h70v17.5h-70Z" />
        <path d="M332.5,140h70v17.5h-70Z" />
        <path d="M332.5,105h70v17.5h-70Z" />
        <path d="M332.5,70h70V87.5h-70Z" />
        <path d="M332.5,35h70V52.5h-70Z" />
        <path d="M332.5,0h70V17.5h-70Z" />
        <path d="M0,490H525v17.5H0Z" />
      </g>
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
