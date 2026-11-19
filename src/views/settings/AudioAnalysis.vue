<template>
  <div class="space-y-6 p-6">
    <SettingsPageForm page="audio_analysis" />
    <AudioAnalysisCoverage />
    <AudioAnalysisFailures />
  </div>
</template>

<script setup lang="ts">
import AudioAnalysisCoverage from "@/components/AudioAnalysisCoverage.vue";
import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
</script>
