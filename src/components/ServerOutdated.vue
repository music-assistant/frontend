<template>
  <div
    class="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground"
  >
    <Empty class="max-w-md">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleArrowUp />
        </EmptyMedia>
        <EmptyTitle>{{ $t("login.server_outdated_title") }}</EmptyTitle>
        <EmptyDescription>
          {{
            $t("login.server_outdated_message", {
              version: api.serverInfo.value?.server_version,
            })
          }}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button @click="reload">{{ $t("login.try_again") }}</Button>
      </EmptyContent>
    </Empty>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { api } from "@/plugins/api";
import { CircleArrowUp } from "@lucide/vue";

const reload = () => window.location.reload();
</script>
