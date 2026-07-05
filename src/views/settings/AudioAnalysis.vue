<template>
  <div class="space-y-6 p-6">
    <AudioAnalysisConcurrency />
    <AudioAnalysisCoverage />
    <AudioAnalysisFailures />
  </div>
</template>

<script setup lang="ts">
import AudioAnalysisConcurrency from "@/components/AudioAnalysisConcurrency.vue";
import AudioAnalysisCoverage from "@/components/AudioAnalysisCoverage.vue";
import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
</script>
