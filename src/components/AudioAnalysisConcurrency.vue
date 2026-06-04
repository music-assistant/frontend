<template>
  <Card>
    <CardHeader>
      <CardTitle>{{
        $t("settings.audio_analysis_concurrency.title")
      }}</CardTitle>
      <CardDescription>
        {{ $t("settings.audio_analysis_concurrency.description") }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button as-child variant="outline">
        <RouterLink to="/settings/editcore/streams">
          {{ $t("settings.audio_analysis_concurrency.open_settings") }}
        </RouterLink>
      </Button>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RouterLink } from "vue-router";
</script>
