<template>
  <AccordionItem value="advanced">
    <AccordionTrigger>
      {{ $t("smart_playlist.section_advanced") }}
    </AccordionTrigger>
    <AccordionContent>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1">
              <Label>{{ $t("smart_playlist.dedup_hours") }}</Label>
              <Tooltip>
                <TooltipTrigger as-child>
                  <span class="cursor-help inline-flex">
                    <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" class="max-w-[220px] z-[10001]">
                  {{ $t("smart_playlist.dedup_hours_tooltip") }}
                </TooltipContent>
              </Tooltip>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground w-16 text-right py-1">
                {{
                  rules.dedup_hours !== undefined
                    ? `${rules.dedup_hours}h`
                    : $t("smart_playlist.off")
                }}
              </span>
              <Button
                v-if="rules.dedup_hours !== undefined"
                variant="ghost"
                size="sm"
                class="h-6 px-2 text-xs"
                @click="rules.dedup_hours = undefined"
              >
                {{ $t("smart_playlist.clear") }}
              </Button>
            </div>
          </div>
          <div class="px-2">
            <Slider
              :model-value="[rules.dedup_hours ?? 0]"
              :min="0"
              :max="24"
              :step="1"
              @update:model-value="
                (v) => {
                  rules.dedup_hours = (v?.[0] ?? 0) === 0 ? undefined : v?.[0];
                }
              "
            />
          </div>
        </div>

        <div class="flex flex-col gap-2 px-1">
          <div class="flex items-center gap-1">
            <Label>{{ $t("smart_playlist.logic") }}</Label>
            <Tooltip>
              <TooltipTrigger as-child>
                <span class="cursor-help inline-flex">
                  <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" class="max-w-[220px] z-[10001]">
                {{ $t("smart_playlist.logic_tooltip") }}
              </TooltipContent>
            </Tooltip>
          </div>
          <Tabs
            :model-value="rules.logic"
            @update:model-value="(v) => (rules.logic = v as 'AND' | 'OR')"
          >
            <TabsList class="h-8">
              <TabsTrigger value="AND" class="text-xs px-4 border-0">
                {{ $t("smart_playlist.logic_and") }}
              </TabsTrigger>
              <TabsTrigger value="OR" class="text-xs px-4 border-0">
                {{ $t("smart_playlist.logic_or") }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</template>

<script setup lang="ts">
import { HelpCircle } from "lucide-vue-next";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SmartPlaylistRulesFormContext } from "@/composables/useSmartPlaylistRulesForm";

const props = defineProps<{ form: SmartPlaylistRulesFormContext }>();

const { rules } = props.form;
</script>
