<template>
  <AccordionItem value="filters">
    <AccordionTrigger>
      <span class="flex items-center gap-2">
        {{ $t("smart_playlist.section_filters") }}
        <span
          v-if="
            rules.favorites_only ||
            rules.min_popularity !== undefined ||
            rules.year_from !== undefined ||
            rules.year_to !== undefined
          "
          class="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0"
        ></span>
      </span>
    </AccordionTrigger>
    <AccordionContent>
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <Label for="srf-fav" class="cursor-pointer">
            {{ $t("smart_playlist.favorites_only") }}
          </Label>
          <Switch
            id="srf-fav"
            v-model="rules.favorites_only"
            @update:model-value="updateTrackCount()"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1">
              <Label>{{ $t("smart_playlist.min_popularity") }}</Label>
              <Tooltip>
                <TooltipTrigger as-child>
                  <span class="cursor-help inline-flex">
                    <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" class="max-w-[220px] z-[10001]">
                  {{ $t("smart_playlist.min_popularity_tooltip") }}
                </TooltipContent>
              </Tooltip>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground w-10 text-right">
                {{
                  rules.min_popularity !== undefined
                    ? `${rules.min_popularity}%`
                    : $t("smart_playlist.any")
                }}
              </span>
              <Button
                v-if="rules.min_popularity !== undefined"
                variant="ghost"
                size="sm"
                class="h-6 px-2 text-xs"
                @click="rules.min_popularity = undefined"
              >
                {{ $t("smart_playlist.clear") }}
              </Button>
            </div>
          </div>
          <div class="px-4">
            <Slider
              :model-value="[rules.min_popularity ?? 0]"
              :min="0"
              :max="100"
              :step="5"
              @update:model-value="
                (v) => {
                  rules.min_popularity =
                    (v?.[0] ?? 0) === 0 ? undefined : v?.[0];
                }
              "
            />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <Label>{{ $t("smart_playlist.year_range") }}</Label>
          <div class="flex items-center gap-2">
            <input
              id="srf-year-from"
              ref="yearFromEl"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              :placeholder="$t('smart_playlist.year_from')"
              class="border-input w-28 h-8 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              @keydown.stop
              @blur="onYearFromInput"
              @keyup.enter="onYearFromInput"
            />
            <span class="text-muted-foreground text-sm">-</span>
            <input
              id="srf-year-to"
              ref="yearToEl"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              :placeholder="$t('smart_playlist.year_to')"
              class="border-input w-28 h-8 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              @keydown.stop
              @blur="onYearToInput"
              @keyup.enter="onYearToInput"
            />
            <Button
              v-if="
                rules.year_from !== undefined || rules.year_to !== undefined
              "
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs"
              @click="clearYear()"
            >
              {{ $t("smart_playlist.clear") }}
            </Button>
          </div>
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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SmartPlaylistRulesFormContext } from "@/composables/useSmartPlaylistRulesForm";

const props = defineProps<{ form: SmartPlaylistRulesFormContext }>();

const {
  rules,
  yearFromEl,
  yearToEl,
  clearYear,
  onYearFromInput,
  onYearToInput,
  _updateTrackCount: updateTrackCount,
} = props.form;
</script>
