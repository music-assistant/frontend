<template>
  <!-- at most four columns, so a page of the list fills every row -->
  <div
    class="grid grid-cols-[repeat(auto-fill,minmax(max(17rem,calc((100%_-_3rem)/4)),1fr))] gap-4 max-sm:grid-cols-1"
  >
    <slot />
  </div>
</template>
