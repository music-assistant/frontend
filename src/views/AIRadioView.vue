<template>
  <section class="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header
      class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <h1
          class="inline-flex items-center text-2xl font-semibold tracking-tight"
        >
          <Sparkles class="mr-2 h-5 w-5" />
          {{ $t("providers.ai_radio.title") }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ $t("providers.ai_radio.header.subtitle") }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" @click="tutorialOpen = true">
          {{ $t("providers.ai_radio.actions.show_tutorial") }}
        </Button>
        <Button
          variant="outline"
          :disabled="isRefreshing"
          @click="handleRefresh"
        >
          {{
            isRefreshing
              ? $t("providers.ai_radio.actions.refreshing")
              : $t("providers.ai_radio.actions.refresh")
          }}
        </Button>
      </div>
    </header>

    <Tabs v-model:model-value="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-3 md:w-[480px]">
        <TabsTrigger value="run">{{
          $t("providers.ai_radio.tabs.run")
        }}</TabsTrigger>
        <TabsTrigger value="stations">{{
          $t("providers.ai_radio.tabs.stations")
        }}</TabsTrigger>
        <TabsTrigger value="sections">{{
          $t("providers.ai_radio.tabs.sections")
        }}</TabsTrigger>
      </TabsList>

      <TabsContent value="run" class="mt-4 space-y-4">
        <div class="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{{ $t("providers.ai_radio.run.title") }}</CardTitle>
              <CardDescription>
                {{ $t("providers.ai_radio.run.description") }}
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="space-y-2">
                <Label for="ai-radio-run-station">{{
                  $t("providers.ai_radio.fields.station")
                }}</Label>
                <Select
                  :model-value="selectedRunStationId"
                  @update:model-value="
                    (value) => onSelectRunStation(value as string)
                  "
                >
                  <SelectTrigger id="ai-radio-run-station" class="w-full">
                    <SelectValue
                      :placeholder="
                        $t('providers.ai_radio.placeholders.station')
                      "
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="station in stations"
                      :key="station.id"
                      :value="station.id"
                    >
                      {{ station.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div
                v-if="hasSourcePlaylistOverride"
                class="space-y-2 rounded-md border border-dashed p-3"
              >
                <div class="text-sm font-medium">
                  {{ $t("providers.ai_radio.run.source_playlist_override") }}
                </div>
                <p class="text-xs text-muted-foreground">
                  {{
                    $t("providers.ai_radio.run.source_playlist_override_help")
                  }}
                </p>
                <div class="text-sm">
                  {{ sourcePlaylistOverrideName || sourcePlaylistOverrideId }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ sourcePlaylistOverrideProvider }}:{{
                    sourcePlaylistOverrideId
                  }}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-auto justify-start px-0"
                  @click="clearSourcePlaylistOverride"
                >
                  {{ $t("providers.ai_radio.run.use_station_source_playlist") }}
                </Button>
              </div>

              <div class="space-y-2">
                <Label for="ai-radio-run-player">{{
                  $t("providers.ai_radio.run.playback_device_override")
                }}</Label>
                <Select
                  :model-value="selectedRunPlayerSelectValue"
                  @update:model-value="
                    (value) => onSelectRunPlayer(value as string)
                  "
                >
                  <SelectTrigger id="ai-radio-run-player" class="w-full">
                    <SelectValue
                      :placeholder="
                        $t(
                          'providers.ai_radio.placeholders.use_station_default',
                        )
                      "
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="DEFAULT_PLAYER_SELECT_VALUE">
                      {{
                        $t(
                          "providers.ai_radio.placeholders.use_station_default",
                        )
                      }}
                    </SelectItem>
                    <SelectItem
                      v-for="player in availableRunPlayers"
                      :key="player.player_id"
                      :value="player.player_id"
                    >
                      {{ player.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                  <Label for="ai-radio-run-source-cap">{{
                    $t("providers.ai_radio.run.source_playtime_cap_override")
                  }}</Label>
                  <Input
                    id="ai-radio-run-source-cap"
                    v-model="runSourcePlaytimeCapOverrideInput"
                    type="number"
                    min="0"
                    step="1"
                    :placeholder="
                      $t('providers.ai_radio.placeholders.use_station_default')
                    "
                  />
                </div>
                <div class="space-y-2">
                  <Label for="ai-radio-run-batch-size">{{
                    $t("providers.ai_radio.run.dynamic_batch_size_override")
                  }}</Label>
                  <Input
                    id="ai-radio-run-batch-size"
                    v-model="runDynamicBatchSizeOverrideInput"
                    type="number"
                    min="1"
                    step="1"
                    :placeholder="
                      $t('providers.ai_radio.placeholders.use_station_default')
                    "
                  />
                </div>
              </div>

              <div class="grid gap-2 sm:grid-cols-2">
                <Button
                  :disabled="!selectedRunStationId || startingRun"
                  @click="startPlaylistRun"
                >
                  <Sparkles class="mr-1 h-4 w-4" />
                  {{
                    startingRun
                      ? $t("providers.ai_radio.actions.starting")
                      : $t("providers.ai_radio.actions.create_playlist")
                  }}
                </Button>
                <Button
                  :disabled="!selectedRunStationId || startingRun"
                  @click="startDynamicRun"
                >
                  <Sparkles class="mr-1 h-4 w-4" />
                  <Radio class="mr-1 h-4 w-4" />
                  {{
                    startingRun
                      ? $t("providers.ai_radio.actions.starting")
                      : $t("providers.ai_radio.actions.start_live_radio")
                  }}
                </Button>
              </div>

              <div class="border-t pt-3">
                <Button variant="outline" @click="openGuidedStationCreator">
                  {{ $t("providers.ai_radio.actions.create_station_guided") }}
                </Button>
                <p class="mt-2 text-xs text-muted-foreground">
                  {{ $t("providers.ai_radio.run.guided_hint") }}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{{
                $t("providers.ai_radio.sessions.title")
              }}</CardTitle>
              <CardDescription>
                {{ $t("providers.ai_radio.sessions.description") }}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                v-if="sessions.length === 0"
                class="text-sm text-muted-foreground"
              >
                {{ $t("providers.ai_radio.sessions.empty") }}
              </div>
              <ul v-else class="space-y-3">
                <li
                  v-for="session in sessions"
                  :key="session.session_id"
                  class="rounded-md border p-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium">{{
                      stationName(session.station_id)
                    }}</span>
                    <Badge :variant="sessionBadgeVariant(session.status)">
                      {{ session.status }}
                    </Badge>
                    <Badge variant="outline">{{ session.mode }}</Badge>
                  </div>
                  <div class="mt-2 text-xs text-muted-foreground">
                    {{ $t("providers.ai_radio.sessions.started") }}:
                    {{
                      formatTimestamp(session.started_at || session.created_at)
                    }}
                  </div>
                  <div
                    v-if="sessionProgressSummary(session)"
                    class="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs"
                  >
                    <div class="font-medium">
                      {{ sessionProgressSummary(session) }}
                    </div>
                    <div
                      v-if="sessionProgressDetails(session)"
                      class="mt-1 text-muted-foreground"
                    >
                      {{ sessionProgressDetails(session) }}
                    </div>
                  </div>
                  <div
                    v-if="sessionErrorMessage(session)"
                    class="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <div class="font-medium">
                      {{ $t("providers.ai_radio.sessions.error") }}
                    </div>
                    <div class="mt-1 break-words">
                      {{ sessionErrorMessage(session) }}
                    </div>
                  </div>
                  <div v-if="session.status === 'running'" class="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      :disabled="stoppingRun"
                      @click="stopSession(session.session_id)"
                    >
                      {{
                        stoppingRun
                          ? $t("providers.ai_radio.actions.stopping")
                          : $t("providers.ai_radio.actions.stop")
                      }}
                    </Button>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="stations" class="mt-4">
        <div class="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{{
                $t("providers.ai_radio.stations.title")
              }}</CardTitle>
              <CardDescription>{{
                $t("providers.ai_radio.stations.description")
              }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <div class="flex flex-wrap gap-2">
                <Button size="sm" @click="createNewStationDraft">{{
                  $t("providers.ai_radio.actions.new")
                }}</Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="openGuidedStationCreator"
                >
                  {{ $t("providers.ai_radio.actions.guided") }}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="triggerStationImport"
                >
                  {{ $t("providers.ai_radio.actions.import") }}
                </Button>
              </div>
              <input
                ref="stationImportInput"
                type="file"
                accept="application/json"
                class="hidden"
                @change="onStationImport"
              />

              <div
                class="max-h-[560px] space-y-1 overflow-y-auto rounded-md border p-2"
              >
                <button
                  v-for="station in stations"
                  :key="station.id"
                  class="w-full rounded-md px-3 py-2 text-left text-sm transition"
                  :class="
                    selectedEditorStationId === station.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  "
                  @click="selectStationForEdit(station.id)"
                >
                  <div class="font-medium">{{ station.name }}</div>
                  <div class="text-xs opacity-80">{{ station.id }}</div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{{
                $t("providers.ai_radio.station_editor.title")
              }}</CardTitle>
              <CardDescription>
                {{ $t("providers.ai_radio.station_editor.description") }}
              </CardDescription>
            </CardHeader>
            <CardContent v-if="stationDraft" class="space-y-6">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2 md:col-span-2">
                  <Label for="station-name">{{
                    $t("providers.ai_radio.fields.station_name")
                  }}</Label>
                  <Input id="station-name" v-model="stationDraft.name" />
                </div>

                <div class="space-y-2">
                  <Label for="station-source-select">{{
                    $t("providers.ai_radio.fields.source_playlist")
                  }}</Label>
                  <select
                    id="station-source-select"
                    v-model="stationSourcePlaylistSelectValue"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">
                      {{ $t("providers.ai_radio.placeholders.select") }}
                    </option>
                    <option
                      v-for="playlist in playlists"
                      :key="
                        playlistSelectValue(playlist.provider, playlist.item_id)
                      "
                      :value="
                        playlistSelectValue(playlist.provider, playlist.item_id)
                      "
                    >
                      {{ playlist.name }} ({{ playlist.provider }}:{{
                        playlist.item_id
                      }})
                    </option>
                    <option value="__custom__">
                      {{
                        $t(
                          "providers.ai_radio.station_editor.custom_source_playlist",
                        )
                      }}
                    </option>
                  </select>
                </div>

                <div class="space-y-2">
                  <Label for="station-default-player">{{
                    $t("providers.ai_radio.fields.default_playback_device")
                  }}</Label>
                  <select
                    id="station-default-player"
                    v-model="stationDraft.default_player_id"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">
                      {{ $t("providers.ai_radio.placeholders.none") }}
                    </option>
                    <option
                      v-for="player in players"
                      :key="player.player_id"
                      :value="player.player_id"
                    >
                      {{ player.name
                      }}{{
                        player.available === false
                          ? ` (${$t("providers.ai_radio.misc.not_available")})`
                          : ""
                      }}
                    </option>
                  </select>
                </div>

                <div
                  v-if="stationSourcePlaylistSelectValue === '__custom__'"
                  class="space-y-2"
                >
                  <Label for="station-source-provider">{{
                    $t("providers.ai_radio.fields.source_playlist_provider")
                  }}</Label>
                  <Input
                    id="station-source-provider"
                    v-model="stationDraft.source_playlist_provider"
                  />
                </div>

                <div
                  v-if="stationSourcePlaylistSelectValue === '__custom__'"
                  class="space-y-2"
                >
                  <Label for="station-source-id">{{
                    $t("providers.ai_radio.fields.source_playlist_id")
                  }}</Label>
                  <Input
                    id="station-source-id"
                    v-model="stationDraft.source_playlist_id"
                  />
                </div>

                <div class="space-y-2">
                  <Label for="station-duration-cap">{{
                    $t("providers.ai_radio.fields.source_playtime_cap")
                  }}</Label>
                  <Input
                    id="station-duration-cap"
                    v-model="stationMaxDurationInput"
                    type="number"
                    min="0"
                    step="1"
                  />
                </div>

                <div class="space-y-2">
                  <Label for="station-target-provider">{{
                    $t("providers.ai_radio.fields.target_playlist_provider")
                  }}</Label>
                  <Input
                    id="station-target-provider"
                    v-model="stationDraft.target_playlist_provider"
                  />
                </div>

                <div class="space-y-2 md:col-span-2">
                  <Label for="station-sections">{{
                    $t("providers.ai_radio.fields.selected_sections")
                  }}</Label>
                  <select
                    id="station-sections"
                    class="min-h-[180px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    multiple
                    :value="stationDraft.section_ids"
                    @change="onStationSectionIdsChange"
                  >
                    <option
                      v-for="section in sections"
                      :key="section.id"
                      :value="section.id"
                    >
                      {{ section.name }}
                    </option>
                  </select>
                  <p class="text-xs text-muted-foreground">
                    {{
                      $t("providers.ai_radio.station_editor.multiselect_hint")
                    }}
                  </p>
                </div>

                <div class="space-y-2 md:col-span-2">
                  <Label for="station-merge-section">{{
                    $t("providers.ai_radio.fields.merge_section")
                  }}</Label>
                  <select
                    id="station-merge-section"
                    v-model="stationDraft.merge_section_id"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">
                      {{ $t("providers.ai_radio.placeholders.none") }}
                    </option>
                    <option
                      v-for="option in mergeSectionOptions"
                      :key="option.id"
                      :value="option.id"
                    >
                      {{ option.name }}
                    </option>
                  </select>
                  <p class="text-xs text-muted-foreground">
                    {{
                      $t("providers.ai_radio.station_editor.merge_section_help")
                    }}
                  </p>
                </div>
              </div>

              <div class="space-y-3 rounded-md border p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 class="text-base font-semibold">
                      {{ $t("providers.ai_radio.flow.title") }}
                    </h3>
                    <p class="text-xs text-muted-foreground">
                      {{ $t("providers.ai_radio.flow.description") }}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" @click="addOrderRule">{{
                    $t("providers.ai_radio.flow.add_rule")
                  }}</Button>
                </div>

                <div
                  v-if="!stationDraft.section_order?.length"
                  class="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
                >
                  {{ $t("providers.ai_radio.flow.empty") }}
                </div>

                <div
                  v-for="(rule, ruleIndex) in stationDraft.section_order"
                  :key="`rule-${ruleIndex}`"
                  class="space-y-3 rounded-md border p-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <Label class="sr-only">{{
                      $t("providers.ai_radio.flow.placement")
                    }}</Label>
                    <select
                      :value="rule.when"
                      class="h-9 rounded-md border bg-background px-3 text-sm"
                      @change="onOrderPlacementChange(ruleIndex, $event)"
                    >
                      <option value="start_of_playlist">
                        {{ $t("providers.ai_radio.placement.start") }}
                      </option>
                      <option value="between_songs">
                        {{ $t("providers.ai_radio.placement.between") }}
                      </option>
                      <option value="end_of_playlist">
                        {{ $t("providers.ai_radio.placement.end") }}
                      </option>
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="moveOrderRule(ruleIndex, -1)"
                    >
                      {{ $t("providers.ai_radio.actions.up") }}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="moveOrderRule(ruleIndex, 1)"
                    >
                      {{ $t("providers.ai_radio.actions.down") }}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="addFlowItem(ruleIndex)"
                    >
                      {{ $t("providers.ai_radio.flow.add_item") }}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      @click="removeOrderRule(ruleIndex)"
                    >
                      {{ $t("providers.ai_radio.flow.remove_rule") }}
                    </Button>
                  </div>

                  <div class="space-y-2">
                    <div
                      v-for="(flowItem, flowIndex) in rule.flow"
                      :key="`flow-${ruleIndex}-${flowIndex}`"
                      class="space-y-2 rounded-md border border-dashed p-3"
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <select
                          :value="getFlowType(flowItem)"
                          class="h-9 rounded-md border bg-background px-3 text-sm"
                          @change="
                            onFlowTypeChange(ruleIndex, flowIndex, $event)
                          "
                        >
                          <option value="MUST">MUST</option>
                          <option value="ALTERNATIVE">ALTERNATIVE</option>
                          <option value="OPTIONAL">OPTIONAL</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          @click="removeFlowItem(ruleIndex, flowIndex)"
                        >
                          {{ $t("providers.ai_radio.actions.remove") }}
                        </Button>
                      </div>

                      <div
                        v-if="getFlowType(flowItem) === 'MUST'"
                        class="space-y-2"
                      >
                        <Label class="text-xs">{{
                          $t("providers.ai_radio.fields.section")
                        }}</Label>
                        <select
                          :value="getMustSection(flowItem)"
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          @change="
                            onMustSectionChange(ruleIndex, flowIndex, $event)
                          "
                        >
                          <option value="">
                            {{
                              $t(
                                "providers.ai_radio.placeholders.select_section",
                              )
                            }}
                          </option>
                          <option
                            v-for="section in stationSelectedSections"
                            :key="`must-${section.id}`"
                            :value="section.id"
                          >
                            {{ section.name }}
                          </option>
                        </select>
                      </div>

                      <div
                        v-else-if="getFlowType(flowItem) === 'ALTERNATIVE'"
                        class="space-y-2"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <Label class="text-xs">{{
                            $t("providers.ai_radio.flow.weighted_choices")
                          }}</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            @click="addAlternativeChoice(ruleIndex, flowIndex)"
                          >
                            {{ $t("providers.ai_radio.flow.add_choice") }}
                          </Button>
                        </div>
                        <div
                          v-for="(choice, choiceIndex) in getAlternativeChoices(
                            flowItem,
                          )"
                          :key="`choice-${ruleIndex}-${flowIndex}-${choiceIndex}`"
                          class="grid gap-2 md:grid-cols-[1fr_160px_auto]"
                        >
                          <select
                            :value="choice.section"
                            class="h-9 rounded-md border bg-background px-3 text-sm"
                            @change="
                              onAlternativeChoiceSectionChange(
                                ruleIndex,
                                flowIndex,
                                choiceIndex,
                                $event,
                              )
                            "
                          >
                            <option value="">
                              {{
                                $t(
                                  "providers.ai_radio.placeholders.select_section",
                                )
                              }}
                            </option>
                            <option
                              v-for="section in stationSelectedSections"
                              :key="`alt-${section.id}`"
                              :value="section.id"
                            >
                              {{ section.name }}
                            </option>
                          </select>
                          <Input
                            :model-value="String(choice.weight ?? 1)"
                            type="number"
                            min="0"
                            step="1"
                            @update:model-value="
                              (value) =>
                                onAlternativeChoiceWeightChange(
                                  ruleIndex,
                                  flowIndex,
                                  choiceIndex,
                                  value,
                                )
                            "
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            @click="
                              removeAlternativeChoice(
                                ruleIndex,
                                flowIndex,
                                choiceIndex,
                              )
                            "
                          >
                            {{ $t("providers.ai_radio.actions.remove") }}
                          </Button>
                        </div>
                      </div>

                      <div v-else class="grid gap-2 md:grid-cols-2">
                        <div class="space-y-2">
                          <Label class="text-xs">{{
                            $t("providers.ai_radio.fields.section")
                          }}</Label>
                          <select
                            :value="getOptionalSection(flowItem)"
                            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                            @change="
                              onOptionalSectionChange(
                                ruleIndex,
                                flowIndex,
                                $event,
                              )
                            "
                          >
                            <option value="">
                              {{
                                $t(
                                  "providers.ai_radio.placeholders.select_section",
                                )
                              }}
                            </option>
                            <option
                              v-for="section in stationSelectedSections"
                              :key="`opt-${section.id}`"
                              :value="section.id"
                            >
                              {{ section.name }}
                            </option>
                          </select>
                        </div>
                        <div class="space-y-2">
                          <Label class="text-xs">{{
                            $t("providers.ai_radio.fields.chance_percent")
                          }}</Label>
                          <Input
                            :model-value="
                              String(getOptionalChancePercent(flowItem))
                            "
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            @update:model-value="
                              (value) =>
                                onOptionalChanceChange(
                                  ruleIndex,
                                  flowIndex,
                                  value,
                                )
                            "
                          />
                        </div>
                        <div class="space-y-2">
                          <Label class="text-xs">{{
                            $t("providers.ai_radio.fields.guard_min_song_gap")
                          }}</Label>
                          <Input
                            :model-value="String(getOptionalMinGap(flowItem))"
                            type="number"
                            min="0"
                            step="1"
                            @update:model-value="
                              (value) =>
                                onOptionalMinGapChange(
                                  ruleIndex,
                                  flowIndex,
                                  value,
                                )
                            "
                          />
                        </div>
                        <div class="space-y-2">
                          <Label class="text-xs">{{
                            $t("providers.ai_radio.fields.guard_max_per_60")
                          }}</Label>
                          <Input
                            :model-value="String(getOptionalMaxPer60(flowItem))"
                            type="number"
                            min="0"
                            step="1"
                            @update:model-value="
                              (value) =>
                                onOptionalMaxPerChange(
                                  ruleIndex,
                                  flowIndex,
                                  value,
                                )
                            "
                          />
                        </div>
                        <div class="space-y-2 md:col-span-2">
                          <Label class="text-xs">{{
                            $t("providers.ai_radio.fields.guard_placeholders")
                          }}</Label>
                          <Input
                            :model-value="getOptionalPlaceholders(flowItem)"
                            @update:model-value="
                              (value) =>
                                onOptionalPlaceholdersChange(
                                  ruleIndex,
                                  flowIndex,
                                  value,
                                )
                            "
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <details class="rounded-md border p-4">
                <summary class="cursor-pointer select-none text-sm font-medium">
                  {{ $t("providers.ai_radio.station_editor.advanced") }}
                </summary>
                <div
                  class="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2 md:gap-x-8 [&>div]:min-w-0"
                >
                  <div class="space-y-2">
                    <Label for="station-id">{{
                      $t("providers.ai_radio.fields.station_id")
                    }}</Label>
                    <Input id="station-id" v-model="stationDraft.id" />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-clear-queue">{{
                      $t(
                        "providers.ai_radio.fields.clear_queue_on_dynamic_start",
                      )
                    }}</Label>
                    <div class="flex h-10 items-center rounded-md border px-3">
                      <input
                        id="station-clear-queue"
                        v-model="stationDraft.clear_queue_on_start"
                        type="checkbox"
                        class="h-4 w-4"
                      />
                    </div>
                  </div>

                  <div class="space-y-2">
                    <Label for="station-dynamic-batch">{{
                      $t("providers.ai_radio.fields.dynamic_batch_size")
                    }}</Label>
                    <Input
                      id="station-dynamic-batch"
                      v-model="stationDynamicBatchSizeInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-dynamic-prefetch">{{
                      $t("providers.ai_radio.fields.dynamic_prefetch_remaining")
                    }}</Label>
                    <Input
                      id="station-dynamic-prefetch"
                      v-model="stationDynamicPrefetchInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="station-dynamic-poll">{{
                      $t("providers.ai_radio.fields.dynamic_poll_seconds")
                    }}</Label>
                    <Input
                      id="station-dynamic-poll"
                      v-model="stationDynamicPollInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>

                  <div class="space-y-2">
                    <Label for="station-general-timezone">{{
                      $t("providers.ai_radio.fields.timezone")
                    }}</Label>
                    <Input
                      id="station-general-timezone"
                      v-model="stationDraft.general.timezone"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-city">{{
                      $t("providers.ai_radio.fields.weather_city")
                    }}</Label>
                    <Input
                      id="station-general-city"
                      v-model="stationDraft.general.location.city"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-country">{{
                      $t("providers.ai_radio.fields.weather_country")
                    }}</Label>
                    <Input
                      id="station-general-country"
                      v-model="stationDraft.general.location.country"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-weather-provider">{{
                      $t("providers.ai_radio.fields.weather_provider")
                    }}</Label>
                    <Input
                      id="station-general-weather-provider"
                      v-model="stationDraft.general.weather_provider"
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="station-general-weather-timeout">{{
                      $t("providers.ai_radio.fields.weather_timeout_seconds")
                    }}</Label>
                    <Input
                      id="station-general-weather-timeout"
                      v-model="stationWeatherTimeoutInput"
                      type="number"
                      min="1"
                      step="1"
                    />
                  </div>
                  <div class="space-y-2 md:col-span-2">
                    <Label for="station-general-instructions">{{
                      $t("providers.ai_radio.fields.instructions")
                    }}</Label>
                    <Textarea
                      id="station-general-instructions"
                      v-model="stationDraft.general.instructions"
                      rows="6"
                    />
                  </div>
                </div>
              </details>

              <div class="flex flex-wrap gap-2">
                <Button :disabled="savingStation" @click="saveStationDraft">
                  {{
                    savingStation
                      ? $t("providers.ai_radio.actions.saving")
                      : $t("providers.ai_radio.actions.save_station")
                  }}
                </Button>
                <Button variant="outline" @click="validateStationDraftOnServer">
                  {{ $t("providers.ai_radio.actions.validate") }}
                </Button>
                <Button variant="outline" @click="exportStationDraft">{{
                  $t("providers.ai_radio.actions.export")
                }}</Button>
                <Button
                  variant="destructive"
                  :disabled="!selectedEditorStationId || deletingStation"
                  @click="removeSelectedStation"
                >
                  {{
                    deletingStation
                      ? $t("providers.ai_radio.actions.deleting")
                      : $t("providers.ai_radio.actions.delete")
                  }}
                </Button>
              </div>
            </CardContent>
            <CardContent v-else>
              <p class="text-sm text-muted-foreground">
                {{ $t("providers.ai_radio.station_editor.empty") }}
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="sections" class="mt-4">
        <div class="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{{
                $t("providers.ai_radio.sections.title")
              }}</CardTitle>
              <CardDescription>{{
                $t("providers.ai_radio.sections.description")
              }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <div class="flex flex-wrap gap-2">
                <Button size="sm" @click="createNewSectionDraft">{{
                  $t("providers.ai_radio.actions.new")
                }}</Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="triggerSectionImport"
                >
                  {{ $t("providers.ai_radio.actions.import") }}
                </Button>
              </div>
              <input
                ref="sectionImportInput"
                type="file"
                accept="application/json"
                class="hidden"
                @change="onSectionImport"
              />

              <div
                class="max-h-[560px] space-y-1 overflow-y-auto rounded-md border p-2"
              >
                <button
                  v-for="section in sections"
                  :key="section.id"
                  class="w-full rounded-md px-3 py-2 text-left text-sm transition"
                  :class="
                    selectedEditorSectionId === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  "
                  @click="selectSectionForEdit(section.id)"
                >
                  <div class="font-medium">{{ section.name }}</div>
                  <div class="text-xs opacity-80">{{ section.id }}</div>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{{
                $t("providers.ai_radio.section_editor.title")
              }}</CardTitle>
              <CardDescription>
                {{ $t("providers.ai_radio.section_editor.description") }}
              </CardDescription>
            </CardHeader>
            <CardContent v-if="sectionDraft" class="space-y-4">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2 md:col-span-2">
                  <Label for="section-name">{{
                    $t("providers.ai_radio.fields.section_name")
                  }}</Label>
                  <Input id="section-name" v-model="sectionDraft.name" />
                </div>

                <div class="space-y-2">
                  <Label for="section-type">{{
                    $t("providers.ai_radio.fields.section_type")
                  }}</Label>
                  <select
                    id="section-type"
                    v-model="sectionDraft.type"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="ai_text">ai_text</option>
                    <option value="ai_meta">ai_meta</option>
                  </select>
                </div>

                <div
                  class="space-y-2"
                  :class="{ 'opacity-60': sectionDraft.type !== 'ai_text' }"
                >
                  <Label for="section-web-search">{{
                    $t("providers.ai_radio.fields.web_search_mode")
                  }}</Label>
                  <select
                    id="section-web-search"
                    v-model="sectionDraft.web_search"
                    :disabled="sectionDraft.type !== 'ai_text'"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="disabled">
                      {{ $t("providers.ai_radio.web_search.disabled") }}
                    </option>
                    <option value="allow">
                      {{ $t("providers.ai_radio.web_search.allow") }}
                    </option>
                    <option value="force">
                      {{ $t("providers.ai_radio.web_search.force") }}
                    </option>
                  </select>
                  <p class="text-xs text-muted-foreground">
                    {{ $t("providers.ai_radio.web_search.help") }}
                  </p>
                </div>

                <div
                  class="space-y-2"
                  :class="{ 'opacity-60': sectionDraft.type !== 'ai_text' }"
                >
                  <Label for="section-max-chars">{{
                    $t("providers.ai_radio.fields.character_limit")
                  }}</Label>
                  <Input
                    id="section-max-chars"
                    :model-value="
                      String(sectionDraft.constraints?.max_chars ?? 0)
                    "
                    :disabled="sectionDraft.type !== 'ai_text'"
                    type="number"
                    min="0"
                    step="1"
                    @update:model-value="onSectionMaxCharsChange"
                  />
                </div>

                <div class="space-y-2 md:col-span-2">
                  <Label for="section-prompt">{{
                    $t("providers.ai_radio.fields.prompt")
                  }}</Label>
                  <Textarea
                    id="section-prompt"
                    v-model="sectionDraft.prompt"
                    rows="8"
                  />
                </div>
              </div>

              <details class="rounded-md border p-4">
                <summary class="cursor-pointer select-none text-sm font-medium">
                  {{ $t("providers.ai_radio.section_editor.advanced") }}
                </summary>
                <div class="mt-4 space-y-2">
                  <Label for="section-id">{{
                    $t("providers.ai_radio.fields.section_id")
                  }}</Label>
                  <Input id="section-id" v-model="sectionDraft.id" />
                </div>
              </details>

              <div class="flex flex-wrap gap-2">
                <Button :disabled="savingSection" @click="saveSectionDraft">
                  {{
                    savingSection
                      ? $t("providers.ai_radio.actions.saving")
                      : $t("providers.ai_radio.actions.save_section")
                  }}
                </Button>
                <Button variant="outline" @click="exportSectionDraft">{{
                  $t("providers.ai_radio.actions.export")
                }}</Button>
                <Button
                  variant="destructive"
                  :disabled="!selectedEditorSectionId || deletingSection"
                  @click="removeSelectedSection"
                >
                  {{
                    deletingSection
                      ? $t("providers.ai_radio.actions.deleting")
                      : $t("providers.ai_radio.actions.delete")
                  }}
                </Button>
              </div>
            </CardContent>
            <CardContent v-else>
              <p class="text-sm text-muted-foreground">
                {{ $t("providers.ai_radio.section_editor.empty") }}
              </p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="guidedWizardOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{{ $t("providers.ai_radio.wizard.title") }}</DialogTitle>
          <DialogDescription>
            {{ $t("providers.ai_radio.wizard.description") }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.wizard.step", [guidedWizardStep]) }}
          </div>

          <div v-if="guidedWizardStep === 1" class="space-y-4">
            <div class="space-y-2">
              <Label for="guided-station-name">{{
                $t("providers.ai_radio.fields.station_name")
              }}</Label>
              <Input
                id="guided-station-name"
                v-model="guidedWizardStationName"
                :placeholder="
                  $t('providers.ai_radio.wizard.station_name_placeholder')
                "
              />
            </div>

            <div class="space-y-2">
              <Label for="guided-source-playlist">{{
                $t("providers.ai_radio.fields.source_playlist")
              }}</Label>
              <select
                id="guided-source-playlist"
                v-model="guidedWizardSourcePlaylistSelectValue"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">
                  {{ $t("providers.ai_radio.placeholders.select") }}
                </option>
                <option
                  v-for="playlist in playlists"
                  :key="
                    playlistSelectValue(playlist.provider, playlist.item_id)
                  "
                  :value="
                    playlistSelectValue(playlist.provider, playlist.item_id)
                  "
                >
                  {{ playlist.name }} ({{ playlist.provider }}:{{
                    playlist.item_id
                  }})
                </option>
              </select>
            </div>

            <div class="space-y-2">
              <Label for="guided-default-player">{{
                $t("providers.ai_radio.fields.default_playback_device")
              }}</Label>
              <select
                id="guided-default-player"
                v-model="guidedWizardDefaultPlayerId"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">
                  {{ $t("providers.ai_radio.placeholders.none") }}
                </option>
                <option
                  v-for="player in players"
                  :key="player.player_id"
                  :value="player.player_id"
                >
                  {{ player.name
                  }}{{
                    player.available === false
                      ? ` (${$t("providers.ai_radio.misc.not_available")})`
                      : ""
                  }}
                </option>
              </select>
            </div>
          </div>

          <div v-else-if="guidedWizardStep === 2" class="space-y-5">
            <div class="space-y-2">
              <Label>{{
                $t("providers.ai_radio.wizard.choose_existing_sections")
              }}</Label>
              <p class="text-xs text-muted-foreground">
                {{
                  $t("providers.ai_radio.wizard.choose_existing_sections_help")
                }}
              </p>
              <div
                class="max-h-[240px] space-y-2 overflow-y-auto rounded-md border p-3"
              >
                <label
                  v-for="section in wizardSelectableSections"
                  :key="`guided-${section.id}`"
                  class="flex items-start gap-2 rounded-md border p-2"
                >
                  <input
                    type="checkbox"
                    class="mt-1 h-4 w-4"
                    :checked="guidedWizardSectionIds.includes(section.id)"
                    @change="onGuidedSectionToggle(section.id, $event)"
                  />
                  <span class="text-sm">
                    <span class="font-medium">{{ section.name }}</span>
                  </span>
                </label>
              </div>
            </div>

            <div class="space-y-2 rounded-md border p-3">
              <Label>{{
                $t("providers.ai_radio.wizard.add_new_section")
              }}</Label>
              <p class="text-xs text-muted-foreground">
                {{ $t("providers.ai_radio.wizard.add_new_section_help") }}
              </p>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-2">
                  <Label for="guided-new-section-name">{{
                    $t("providers.ai_radio.fields.section_name")
                  }}</Label>
                  <Input
                    id="guided-new-section-name"
                    v-model="guidedNewSectionName"
                    :placeholder="
                      $t('providers.ai_radio.wizard.section_name_placeholder')
                    "
                  />
                </div>
                <div class="space-y-2">
                  <Label for="guided-new-section-placement">{{
                    $t("providers.ai_radio.fields.insert_at")
                  }}</Label>
                  <select
                    id="guided-new-section-placement"
                    v-model="guidedNewSectionPlacement"
                    class="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="start_of_playlist">
                      {{ $t("providers.ai_radio.placement.start") }}
                    </option>
                    <option value="between_songs">
                      {{ $t("providers.ai_radio.placement.between") }}
                    </option>
                    <option value="end_of_playlist">
                      {{ $t("providers.ai_radio.placement.end") }}
                    </option>
                  </select>
                </div>
                <div class="space-y-2 md:col-span-2">
                  <Label for="guided-new-section-prompt">{{
                    $t("providers.ai_radio.fields.prompt")
                  }}</Label>
                  <Textarea
                    id="guided-new-section-prompt"
                    v-model="guidedNewSectionPrompt"
                    rows="4"
                  />
                </div>
              </div>
              <Button
                class="mt-1"
                variant="outline"
                :disabled="creatingGuidedSection"
                @click="createGuidedSection"
              >
                {{
                  creatingGuidedSection
                    ? $t("providers.ai_radio.actions.adding")
                    : $t("providers.ai_radio.actions.add_section")
                }}
              </Button>
            </div>

            <div class="space-y-2">
              <Label>{{
                $t("providers.ai_radio.wizard.selected_sections")
              }}</Label>
              <div
                v-if="guidedWizardSelectedSections.length === 0"
                class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
              >
                {{ $t("providers.ai_radio.wizard.no_sections_selected") }}
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="section in guidedWizardSelectedSections"
                  :key="`guided-placement-${section.id}`"
                  class="grid items-center gap-2 rounded-md border p-2 md:grid-cols-[1fr_220px]"
                >
                  <div class="text-sm font-medium">{{ section.name }}</div>
                  <select
                    :value="
                      guidedWizardSectionPlacements[section.id] ||
                      'between_songs'
                    "
                    class="h-9 rounded-md border bg-background px-3 text-sm"
                    @change="onGuidedSectionPlacementChange(section.id, $event)"
                  >
                    <option value="start_of_playlist">
                      {{ $t("providers.ai_radio.placement.start") }}
                    </option>
                    <option value="between_songs">
                      {{ $t("providers.ai_radio.placement.between") }}
                    </option>
                    <option value="end_of_playlist">
                      {{ $t("providers.ai_radio.placement.end") }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="guided-merge-section">{{
                $t("providers.ai_radio.fields.merge_section")
              }}</Label>
              <select
                id="guided-merge-section"
                v-model="guidedWizardMergeSectionId"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">
                  {{ $t("providers.ai_radio.placeholders.none") }}
                </option>
                <option
                  v-for="section in guidedWizardMergeSectionOptions"
                  :key="`guided-merge-${section.id}`"
                  :value="section.id"
                >
                  {{ section.name }}
                </option>
              </select>
              <p class="text-xs text-muted-foreground">
                {{ $t("providers.ai_radio.wizard.merge_section_help") }}
              </p>
            </div>
          </div>

          <div v-else class="space-y-3 text-sm">
            <div class="rounded-md border p-3">
              <div>
                <span class="font-medium"
                  >{{ $t("providers.ai_radio.wizard.summary_name") }}:</span
                >
                {{ guidedWizardStationName }}
              </div>
              <div>
                <span class="font-medium"
                  >{{ $t("providers.ai_radio.wizard.summary_source") }}:</span
                >
                {{ guidedWizardSourcePlaylistLabel }}
              </div>
              <div>
                <span class="font-medium"
                  >{{ $t("providers.ai_radio.wizard.summary_sections") }}:</span
                >
                {{
                  guidedWizardSelectedSectionNames.join(", ") ||
                  $t("providers.ai_radio.placeholders.none")
                }}
              </div>
              <div v-if="guidedWizardSectionPlacementSummary.length">
                <span class="font-medium"
                  >{{
                    $t("providers.ai_radio.wizard.summary_placement")
                  }}:</span
                >
                {{ guidedWizardSectionPlacementSummary.join(" | ") }}
              </div>
              <div v-if="guidedWizardMergeSectionName">
                <span class="font-medium"
                  >{{
                    $t("providers.ai_radio.wizard.summary_merge_section")
                  }}:</span
                >
                {{ guidedWizardMergeSectionName }}
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ $t("providers.ai_radio.wizard.summary_help") }}
            </p>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button variant="outline" @click="guidedWizardOpen = false">
            {{ $t("providers.ai_radio.actions.cancel") }}
          </Button>
          <Button
            v-if="guidedWizardStep > 1"
            variant="outline"
            @click="guidedWizardStep = guidedWizardStep - 1"
          >
            {{ $t("providers.ai_radio.actions.back") }}
          </Button>
          <Button
            v-if="guidedWizardStep < 3"
            :disabled="!canProceedGuidedWizardStep"
            @click="guidedWizardStep = guidedWizardStep + 1"
          >
            {{ $t("providers.ai_radio.actions.next") }}
          </Button>
          <Button
            v-else
            :disabled="creatingGuidedStation"
            @click="createGuidedStation"
          >
            {{
              creatingGuidedStation
                ? $t("providers.ai_radio.actions.creating")
                : $t("providers.ai_radio.actions.create_station")
            }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="tutorialOpen">
      <DialogContent class="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{{
            $t("providers.ai_radio.tutorial.title")
          }}</DialogTitle>
          <DialogDescription>
            {{ $t("providers.ai_radio.tutorial.description") }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 text-sm">
          <div class="rounded-md border p-3">
            <div class="font-medium">
              {{ $t("providers.ai_radio.tutorial.station_title") }}
            </div>
            <p class="mt-1 text-muted-foreground">
              {{ $t("providers.ai_radio.tutorial.station_text") }}
            </p>
          </div>

          <div class="rounded-md border p-3">
            <div class="font-medium">
              {{ $t("providers.ai_radio.tutorial.section_title") }}
            </div>
            <p class="mt-1 text-muted-foreground">
              {{ $t("providers.ai_radio.tutorial.section_text") }}
            </p>
          </div>

          <div class="rounded-md border p-3">
            <div class="font-medium">
              {{ $t("providers.ai_radio.tutorial.flow_title") }}
            </div>
            <p class="mt-1 text-muted-foreground">
              {{ $t("providers.ai_radio.tutorial.flow_text") }}
            </p>
          </div>

          <div class="rounded-md border p-3">
            <div class="font-medium">
              {{ $t("providers.ai_radio.tutorial.run_modes_title") }}
            </div>
            <p class="mt-1 text-muted-foreground">
              {{ $t("providers.ai_radio.tutorial.run_modes_text") }}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button @click="closeTutorial">{{
            $t("providers.ai_radio.actions.done")
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAiRadio } from "@/composables/useAiRadio";
import { useAiRadioEditor } from "@/composables/useAiRadioEditor";
import type {
  AIRadioAlternativeChoice,
  AIRadioFlowItem,
  AIRadioMode,
  AIRadioOptionalGuards,
  AIRadioPlacement,
  AIRadioSection,
  AIRadioSectionOrderRule,
  AIRadioSession,
  AIRadioStation,
  AIRadioStationGeneral,
  Player,
  Playlist,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Radio, Sparkles } from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

const DEFAULT_PLAYER_SELECT_VALUE = "__station_default__";
const AUTO_REFRESH_MS = 5000;
const TUTORIAL_SEEN_STORAGE_KEY = "ai_radio_tutorial_seen_v1";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
type AIRadioFlowType = "MUST" | "ALTERNATIVE" | "OPTIONAL";
type AIRadioStationDraft = Omit<AIRadioStation, "general"> & {
  general: AIRadioStationGeneral;
};
type AIRadioProgressPhase =
  | "fetch_source_tracks"
  | "initializing_queue"
  | "planning_sections"
  | "generating_llm"
  | "generating_tts"
  | "publishing_playlist"
  | "queueing_batch"
  | "waiting_for_playback"
  | "running";

const activeTab = ref<"run" | "stations" | "sections">("run");

const route = useRoute();
const router = useRouter();

const {
  sessions,
  loadingStatus,
  startingRun,
  stoppingRun,
  startRun,
  stopRun,
  loadStatus,
} = useAiRadio();

const {
  stations,
  sections,
  players,
  playlists,
  loadingStations,
  loadingSections,
  loadingPlayers,
  loadingPlaylists,
  savingStation,
  deletingStation,
  savingSection,
  deletingSection,
  refreshEditor,
  saveStation,
  deleteStation,
  getStation,
  validateStation,
  saveSection,
  deleteSection,
  getSection,
  createStationDraftFromTemplate,
  createSectionDraftFromTemplate,
  deepClone,
} = useAiRadioEditor();

const selectedRunStationId = ref("");
const selectedRunPlayerId = ref("");
const runSourcePlaytimeCapOverrideInput = ref("");
const runDynamicBatchSizeOverrideInput = ref("");

const sourcePlaylistOverrideId = ref("");
const sourcePlaylistOverrideProvider = ref("");
const sourcePlaylistOverrideName = ref("");

const selectedEditorStationId = ref("");
const stationDraft = ref<AIRadioStationDraft | null>(null);

const selectedEditorSectionId = ref("");
const sectionDraft = ref<AIRadioSection | null>(null);

const stationImportInput = ref<HTMLInputElement | null>(null);
const sectionImportInput = ref<HTMLInputElement | null>(null);

const guidedWizardOpen = ref(false);
const guidedWizardStep = ref(1);
const creatingGuidedStation = ref(false);
const guidedWizardStationName = ref("");
const guidedWizardSourcePlaylistSelectValue = ref("");
const guidedWizardDefaultPlayerId = ref("");
const guidedWizardSectionIds = ref<string[]>([]);
const guidedWizardMergeSectionId = ref("");
const guidedWizardSectionPlacements = ref<Record<string, AIRadioPlacement>>({});
const creatingGuidedSection = ref(false);
const guidedNewSectionName = ref("");
const guidedNewSectionPrompt = ref("");
const guidedNewSectionPlacement = ref<AIRadioPlacement>("between_songs");

const tutorialOpen = ref(false);

let refreshTimer: ReturnType<typeof setInterval> | null = null;

const isRefreshing = computed(() => {
  return (
    loadingStatus.value ||
    loadingStations.value ||
    loadingSections.value ||
    loadingPlayers.value ||
    loadingPlaylists.value
  );
});

const stationById = computed(() => {
  const output = new Map<string, string>();
  for (const station of stations.value) {
    output.set(station.id, station.name);
  }
  return output;
});

const availableRunPlayers = computed<Player[]>(() => {
  return players.value
    .filter((player) => player.available !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
});

const selectedRunPlayerSelectValue = computed(() => {
  return selectedRunPlayerId.value || DEFAULT_PLAYER_SELECT_VALUE;
});

const hasSourcePlaylistOverride = computed(() => {
  return Boolean(
    sourcePlaylistOverrideId.value && sourcePlaylistOverrideProvider.value,
  );
});

const stationSourcePlaylistSelectValue = computed({
  get: () => {
    if (!stationDraft.value) {
      return "";
    }
    const provider = String(
      stationDraft.value.source_playlist_provider || "",
    ).trim();
    const itemId = String(stationDraft.value.source_playlist_id || "").trim();
    if (!provider || !itemId) {
      return "";
    }
    const value = playlistSelectValue(provider, itemId);
    const inList = playlists.value.some(
      (item) => playlistSelectValue(item.provider, item.item_id) === value,
    );
    return inList ? value : "__custom__";
  },
  set: (value: string) => {
    if (!stationDraft.value || !value) {
      return;
    }
    if (value === "__custom__") {
      if (!stationDraft.value.source_playlist_provider) {
        stationDraft.value.source_playlist_provider = "library";
      }
      return;
    }
    const { provider, itemId } = splitPlaylistSelectValue(value);
    stationDraft.value.source_playlist_provider = provider;
    stationDraft.value.source_playlist_id = itemId;
  },
});

const stationSelectedSections = computed<AIRadioSection[]>(() => {
  if (!stationDraft.value) {
    return [];
  }
  const selected = new Set(stationDraft.value.section_ids || []);
  return sections.value.filter((section) => selected.has(section.id));
});

const mergeSectionOptions = computed(() => {
  return stationSelectedSections.value.filter(
    (section) => section.type === "ai_meta",
  );
});

const guidedWizardSectionById = computed(() => {
  const output = new Map<string, AIRadioSection>();
  for (const section of sections.value) {
    output.set(section.id, section);
  }
  return output;
});

const wizardSelectableSections = computed(() => {
  return sections.value
    .filter((section) => section.type === "ai_text")
    .sort((a, b) => a.name.localeCompare(b.name));
});

const guidedWizardSelectedSections = computed<AIRadioSection[]>(() => {
  return guidedWizardSectionIds.value
    .map((sectionId) => guidedWizardSectionById.value.get(sectionId))
    .filter((section): section is AIRadioSection => Boolean(section));
});

const guidedWizardMergeSectionOptions = computed<AIRadioSection[]>(() => {
  const selectedMeta = guidedWizardSelectedSections.value.filter(
    (section) => section.type === "ai_meta",
  );
  if (selectedMeta.length) {
    return selectedMeta;
  }
  return sections.value.filter((section) => section.type === "ai_meta");
});

const guidedWizardSelectedSectionNames = computed(() => {
  return guidedWizardSelectedSections.value.map((section) => section.name);
});

const guidedWizardMergeSectionName = computed(() => {
  if (!guidedWizardMergeSectionId.value) {
    return "";
  }
  return (
    guidedWizardSectionById.value.get(guidedWizardMergeSectionId.value)?.name ||
    guidedWizardMergeSectionId.value
  );
});

const guidedWizardSectionPlacementSummary = computed(() => {
  return guidedWizardSelectedSections.value.map((section) => {
    const placement =
      guidedWizardSectionPlacements.value[section.id] || "between_songs";
    const placementLabel =
      placement === "start_of_playlist"
        ? $t("providers.ai_radio.placement.start")
        : placement === "end_of_playlist"
          ? $t("providers.ai_radio.placement.end")
          : $t("providers.ai_radio.placement.between");
    return `${section.name} → ${placementLabel}`;
  });
});

const guidedWizardSourcePlaylistLabel = computed(() => {
  if (!guidedWizardSourcePlaylistSelectValue.value) {
    return "-";
  }
  const { provider, itemId } = splitPlaylistSelectValue(
    guidedWizardSourcePlaylistSelectValue.value,
  );
  const playlist = playlists.value.find(
    (item) => item.provider === provider && item.item_id === itemId,
  );
  if (!playlist) {
    return `${provider}:${itemId}`;
  }
  return `${playlist.name} (${playlist.provider}:${playlist.item_id})`;
});

const recommendedGuidedSectionIds = computed<string[]>(() => {
  const textSections = sections.value.filter(
    (section) => section.type === "ai_text",
  );
  if (textSections.length <= 6) {
    return textSections.map((section) => section.id);
  }
  const ranked = [...textSections].sort((a, b) => {
    const aName = `${a.id} ${a.name}`.toLowerCase();
    const bName = `${b.id} ${b.name}`.toLowerCase();
    const score = (value: string) => {
      if (value.includes("intro") || value.includes("start")) return 0;
      if (value.includes("transition") || value.includes("between")) return 1;
      if (value.includes("news") || value.includes("weather")) return 2;
      if (
        value.includes("outro") ||
        value.includes("end") ||
        value.includes("close")
      ) {
        return 3;
      }
      return 4;
    };
    const scoreDiff = score(aName) - score(bName);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.name.localeCompare(b.name);
  });
  return ranked.slice(0, 6).map((section) => section.id);
});

const canProceedGuidedWizardStep = computed(() => {
  if (guidedWizardStep.value === 1) {
    return (
      Boolean(guidedWizardStationName.value.trim()) &&
      Boolean(guidedWizardSourcePlaylistSelectValue.value)
    );
  }
  if (guidedWizardStep.value === 2) {
    return (
      guidedWizardSectionIds.value.length > 0 &&
      guidedWizardSectionIds.value.every((sectionId) =>
        Boolean(guidedWizardSectionPlacements.value[sectionId]),
      )
    );
  }
  return true;
});

const stationMaxDurationInput = computed({
  get: () => String(stationDraft.value?.max_duration_minutes ?? 0),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.max_duration_minutes = safeNumber(value, 0, 0);
  },
});

const stationDynamicBatchSizeInput = computed({
  get: () => String(stationDraft.value?.dynamic_batch_size ?? 1),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_batch_size = safeNumber(value, 1, 1);
  },
});

const stationDynamicPrefetchInput = computed({
  get: () => String(stationDraft.value?.dynamic_prefetch_remaining_tracks ?? 2),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_prefetch_remaining_tracks = safeNumber(
      value,
      1,
      1,
    );
  },
});

const stationDynamicPollInput = computed({
  get: () => String(stationDraft.value?.dynamic_poll_seconds ?? 5),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.dynamic_poll_seconds = safeNumber(value, 1, 1);
  },
});

const stationWeatherTimeoutInput = computed({
  get: () => String(stationDraft.value?.general?.weather_timeout_seconds ?? 8),
  set: (value: string) => {
    if (!stationDraft.value) {
      return;
    }
    stationDraft.value.general.weather_timeout_seconds = safeInteger(
      value,
      1,
      8,
    );
  },
});

const safeNumber = (
  value: string | number,
  min: number,
  fallback: number,
): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

const safeInteger = (
  value: string | number,
  min: number,
  fallback: number,
): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

const parseOptionalNumber = (
  value: string | number | null | undefined,
): number => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  return safeNumber(value, 0, 0);
};

const stationName = (stationId: string) => {
  return stationById.value.get(stationId) || stationId;
};

const sessionBadgeVariant = (
  status: AIRadioSession["status"],
): BadgeVariant => {
  if (status === "running") return "default";
  if (status === "completed") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
};

const toProgressRecord = (session: AIRadioSession): Record<string, unknown> => {
  if (!session.progress || typeof session.progress !== "object") {
    return {};
  }
  return session.progress as Record<string, unknown>;
};

const sessionErrorMessage = (session: AIRadioSession): string => {
  if (session.error) {
    return session.error;
  }
  const progress = toProgressRecord(session);
  const progressError = progress.error || progress.error_message;
  if (typeof progressError === "string") {
    return progressError;
  }
  if (progressError && typeof progressError === "object") {
    return errorMessage(progressError);
  }
  return "";
};

const asProgressNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const progressPhaseLabel = (phase: string): string => {
  const labels: Record<AIRadioProgressPhase, string> = {
    fetch_source_tracks: $t(
      "providers.ai_radio.progress.phase.fetch_source_tracks",
    ),
    initializing_queue: $t(
      "providers.ai_radio.progress.phase.initializing_queue",
    ),
    planning_sections: $t(
      "providers.ai_radio.progress.phase.planning_sections",
    ),
    generating_llm: $t("providers.ai_radio.progress.phase.generating_llm"),
    generating_tts: $t("providers.ai_radio.progress.phase.generating_tts"),
    publishing_playlist: $t(
      "providers.ai_radio.progress.phase.publishing_playlist",
    ),
    queueing_batch: $t("providers.ai_radio.progress.phase.queueing_batch"),
    waiting_for_playback: $t(
      "providers.ai_radio.progress.phase.waiting_for_playback",
    ),
    running: $t("providers.ai_radio.progress.phase.running"),
  };
  return labels[phase as AIRadioProgressPhase] || phase;
};

const sessionProgressSummary = (session: AIRadioSession): string => {
  const progress = toProgressRecord(session);
  const phase = String(progress.phase || progress.step || "").trim();
  if (!phase) {
    return "";
  }
  return progressPhaseLabel(phase);
};

const sessionProgressDetails = (session: AIRadioSession): string => {
  const progress = toProgressRecord(session);
  const phase = String(progress.phase || progress.step || "").trim();
  const queuedTracks = asProgressNumber(progress.queued_tracks);
  const totalTracks = asProgressNumber(progress.total_tracks);
  const batchIndex = asProgressNumber(progress.batch_index);
  const sectionsPlanned = asProgressNumber(progress.sections_planned);
  const sections = asProgressNumber(progress.sections);
  const queueEntries = asProgressNumber(progress.queue_entries);
  const entries = asProgressNumber(progress.entries);
  const tracks = asProgressNumber(progress.tracks);

  if (!phase) {
    return "";
  }
  if (phase === "generating_llm") {
    if (sectionsPlanned !== null && batchIndex !== null) {
      return $t("providers.ai_radio.progress.details.llm_batch", [
        batchIndex,
        sectionsPlanned,
      ]);
    }
    if (sectionsPlanned !== null) {
      return $t("providers.ai_radio.progress.details.llm_sections", [
        sectionsPlanned,
      ]);
    }
  }
  if (phase === "generating_tts") {
    if (sections !== null && batchIndex !== null) {
      return $t("providers.ai_radio.progress.details.tts_batch", [
        batchIndex,
        sections,
      ]);
    }
    if (sections !== null) {
      return $t("providers.ai_radio.progress.details.tts_sections", [sections]);
    }
  }
  if (phase === "queueing_batch") {
    if (batchIndex !== null && queueEntries !== null) {
      return $t("providers.ai_radio.progress.details.queue_batch", [
        batchIndex,
        queueEntries,
      ]);
    }
  }
  if (phase === "waiting_for_playback") {
    if (queuedTracks !== null && totalTracks !== null && batchIndex !== null) {
      return $t("providers.ai_radio.progress.details.waiting", [
        batchIndex,
        queuedTracks,
        totalTracks,
      ]);
    }
  }
  if (phase === "publishing_playlist") {
    if (entries !== null || tracks !== null) {
      const entryText =
        entries !== null
          ? $t("providers.ai_radio.progress.details.entries", [entries])
          : "";
      const trackText =
        tracks !== null
          ? $t("providers.ai_radio.progress.details.source_tracks", [tracks])
          : "";
      return [entryText, trackText].filter(Boolean).join(" · ");
    }
  }
  if (queuedTracks !== null && totalTracks !== null) {
    return $t("providers.ai_radio.progress.details.source_processed", [
      queuedTracks,
      totalTracks,
    ]);
  }
  return "";
};

const formatTimestamp = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const playlistSelectValue = (provider: string, itemId: string) => {
  return `${provider}:::${itemId}`;
};

const splitPlaylistSelectValue = (value: string) => {
  const [provider, itemId] = value.split(":::");
  return {
    provider: provider || "library",
    itemId: itemId || "",
  };
};

const getQueryValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const parseOptionalCapInput = (
  value: string | number | null | undefined,
): number | undefined => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
};

const parseOptionalPositiveInt = (
  value: string | number | null | undefined,
): number | undefined => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

const asGeneralDefaults = (
  general?: AIRadioStationGeneral,
): AIRadioStationGeneral => {
  return {
    timezone: general?.timezone || "UTC",
    location: {
      city: general?.location?.city || "",
      country: general?.location?.country || "",
    },
    instructions: general?.instructions || "",
    weather_provider: general?.weather_provider || "open_meteo",
    weather_timeout_seconds:
      typeof general?.weather_timeout_seconds === "number"
        ? general.weather_timeout_seconds
        : 8,
  };
};

const normalizeStationDraft = (
  station: AIRadioStation,
): AIRadioStationDraft => {
  const draft = deepClone(station);
  draft.id = String(draft.id || "").trim();
  draft.name = String(draft.name || "").trim();
  draft.source_playlist_id = String(draft.source_playlist_id || "").trim();
  draft.source_playlist_provider =
    String(draft.source_playlist_provider || "library").trim() || "library";
  draft.target_playlist_provider =
    String(draft.target_playlist_provider || "builtin").trim() || "builtin";
  draft.default_player_id = String(draft.default_player_id || "").trim();
  draft.max_duration_minutes = parseOptionalNumber(draft.max_duration_minutes);
  draft.dynamic_batch_size = safeInteger(
    String(draft.dynamic_batch_size ?? 1),
    1,
    1,
  );
  draft.dynamic_poll_seconds = safeInteger(
    String(draft.dynamic_poll_seconds ?? 5),
    1,
    5,
  );
  draft.dynamic_prefetch_remaining_tracks = safeInteger(
    String(draft.dynamic_prefetch_remaining_tracks ?? 2),
    1,
    2,
  );
  draft.clear_queue_on_start = draft.clear_queue_on_start !== false;
  draft.merge_section_id = String(draft.merge_section_id || "").trim();
  draft.section_ids = Array.isArray(draft.section_ids)
    ? [...draft.section_ids]
    : [];
  draft.section_order = Array.isArray(draft.section_order)
    ? deepClone(draft.section_order)
    : [];
  draft.sections = [];
  draft.general = asGeneralDefaults(draft.general);
  return draft as AIRadioStationDraft;
};

const normalizeSectionDraft = (section: AIRadioSection): AIRadioSection => {
  const draft = deepClone(section);
  draft.id = String(draft.id || "").trim();
  draft.name = String(draft.name || "").trim();
  draft.type = draft.type === "ai_meta" ? "ai_meta" : "ai_text";
  draft.prompt = String(draft.prompt || "");
  draft.web_search = draft.web_search || "disabled";
  draft.constraints = {
    max_chars: safeInteger(String(draft.constraints?.max_chars ?? 0), 0, 0),
  };
  return draft;
};

const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "item";
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object") {
    const data = error as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "reason"]) {
      if (typeof data[key] === "string" && data[key].trim()) {
        return data[key];
      }
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

const closeTutorial = () => {
  tutorialOpen.value = false;
  localStorage.setItem(TUTORIAL_SEEN_STORAGE_KEY, "1");
};

const defaultGuidedPlacement = (section: AIRadioSection): AIRadioPlacement => {
  const label = `${section.id} ${section.name}`.toLowerCase();
  // Check end-of-playlist markers first because section names like
  // "Song_Introduction_End" otherwise match the loose "intro" substring below.
  if (
    label.includes("outro") ||
    /(^|[\s_-])end([\s_-]|$)/.test(label) ||
    label.includes("closing") ||
    label.includes("signoff") ||
    label.includes("sign-off")
  ) {
    return "end_of_playlist";
  }
  if (
    /(^|[\s_-])intro([\s_-]|$)/.test(label) ||
    label.includes("start") ||
    label.includes("opening")
  ) {
    return "start_of_playlist";
  }
  return "between_songs";
};

const applyRouteOverrides = () => {
  const querySourcePlaylistId = getQueryValue(route.query.source_playlist_id);
  const querySourcePlaylistProvider = getQueryValue(
    route.query.source_playlist_provider,
  );
  const querySourcePlaylistName = getQueryValue(
    route.query.source_playlist_name,
  );

  if (querySourcePlaylistId && querySourcePlaylistProvider) {
    sourcePlaylistOverrideId.value = querySourcePlaylistId;
    sourcePlaylistOverrideProvider.value = querySourcePlaylistProvider;
    sourcePlaylistOverrideName.value = querySourcePlaylistName;
    activeTab.value = "run";
  } else {
    sourcePlaylistOverrideId.value = "";
    sourcePlaylistOverrideProvider.value = "";
    sourcePlaylistOverrideName.value = "";
  }

  const queryStationId = getQueryValue(route.query.station_id);
  if (
    queryStationId &&
    stations.value.some((station) => station.id === queryStationId)
  ) {
    selectedRunStationId.value = queryStationId;
    applyRunStationDefaults(queryStationId);
  } else if (!selectedRunStationId.value && stations.value.length > 0) {
    selectedRunStationId.value = stations.value[0].id;
    applyRunStationDefaults(stations.value[0].id);
  }
};

const clearSourcePlaylistOverride = async () => {
  sourcePlaylistOverrideId.value = "";
  sourcePlaylistOverrideProvider.value = "";
  sourcePlaylistOverrideName.value = "";

  const query = { ...route.query };
  delete query.source_playlist_id;
  delete query.source_playlist_provider;
  delete query.source_playlist_name;
  await router.replace({ query });
};

const applyRunStationDefaults = (stationId: string) => {
  const station = stations.value.find((item) => item.id === stationId);
  selectedRunPlayerId.value = station?.default_player_id || "";
};

const onSelectRunStation = (stationId: string) => {
  selectedRunStationId.value = stationId;
  applyRunStationDefaults(stationId);
};

const onSelectRunPlayer = (value: string) => {
  selectedRunPlayerId.value =
    value === DEFAULT_PLAYER_SELECT_VALUE ? "" : value;
};

const runStart = async (mode: AIRadioMode) => {
  if (!selectedRunStationId.value) {
    toast.error($t("providers.ai_radio.validation.select_station_first"));
    return;
  }
  try {
    await startRun(selectedRunStationId.value, mode, {
      playerIdOverride: selectedRunPlayerId.value || undefined,
      sourcePlaylistIdOverride: sourcePlaylistOverrideId.value || undefined,
      sourcePlaylistProviderOverride:
        sourcePlaylistOverrideProvider.value || undefined,
      dynamicSourcePlaytimeCapOverride: parseOptionalCapInput(
        runSourcePlaytimeCapOverrideInput.value,
      ),
      dynamicBatchSizeOverride: parseOptionalPositiveInt(
        runDynamicBatchSizeOverrideInput.value,
      ),
    });
    await loadStatus(true);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.run_start_failed", [errorMessage(error)]),
    );
  }
};

const startPlaylistRun = async () => {
  await runStart("playlist");
};

const startDynamicRun = async () => {
  await runStart("dynamic");
};

const stopSession = async (sessionId: string) => {
  try {
    await stopRun(sessionId);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.stop_failed", [errorMessage(error)]),
    );
  }
};

const handleRefresh = async () => {
  try {
    await Promise.all([refreshEditor(true), loadStatus(true)]);
    applyRouteOverrides();
    toast.success($t("providers.ai_radio.toast.data_refreshed"));
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.refresh_failed", [errorMessage(error)]),
    );
  }
};

const openGuidedStationCreator = () => {
  guidedWizardOpen.value = true;
  guidedWizardStep.value = 1;
  guidedWizardStationName.value = "";
  if (sourcePlaylistOverrideName.value) {
    guidedWizardStationName.value = `AI Radio - ${sourcePlaylistOverrideName.value}`;
  }

  if (sourcePlaylistOverrideId.value && sourcePlaylistOverrideProvider.value) {
    guidedWizardSourcePlaylistSelectValue.value = playlistSelectValue(
      sourcePlaylistOverrideProvider.value,
      sourcePlaylistOverrideId.value,
    );
  } else {
    guidedWizardSourcePlaylistSelectValue.value = playlists.value[0]
      ? playlistSelectValue(
          playlists.value[0].provider,
          playlists.value[0].item_id,
        )
      : "";
  }

  guidedWizardDefaultPlayerId.value = "";
  const runStation = stations.value.find(
    (item) => item.id === selectedRunStationId.value,
  );
  if (runStation?.default_player_id) {
    guidedWizardDefaultPlayerId.value = runStation.default_player_id;
  } else if (availableRunPlayers.value[0]) {
    guidedWizardDefaultPlayerId.value = availableRunPlayers.value[0].player_id;
  }

  guidedWizardSectionIds.value = [...recommendedGuidedSectionIds.value];
  guidedWizardSectionPlacements.value = {};
  for (const sectionId of guidedWizardSectionIds.value) {
    const section = guidedWizardSectionById.value.get(sectionId);
    if (!section) {
      continue;
    }
    guidedWizardSectionPlacements.value[sectionId] =
      defaultGuidedPlacement(section);
  }
  guidedWizardMergeSectionId.value = "";
  if (guidedWizardMergeSectionOptions.value[0]) {
    guidedWizardMergeSectionId.value =
      guidedWizardMergeSectionOptions.value[0].id;
  }
  guidedNewSectionName.value = "";
  guidedNewSectionPrompt.value = "";
  guidedNewSectionPlacement.value = "between_songs";
};

const onGuidedSectionToggle = (sectionId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.checked) {
    if (!guidedWizardSectionIds.value.includes(sectionId)) {
      guidedWizardSectionIds.value = [
        ...guidedWizardSectionIds.value,
        sectionId,
      ];
    }
    if (!guidedWizardSectionPlacements.value[sectionId]) {
      const section = guidedWizardSectionById.value.get(sectionId);
      if (section) {
        guidedWizardSectionPlacements.value[sectionId] =
          defaultGuidedPlacement(section);
      }
    }
    return;
  }
  guidedWizardSectionIds.value = guidedWizardSectionIds.value.filter(
    (item) => item !== sectionId,
  );
  delete guidedWizardSectionPlacements.value[sectionId];
  if (
    guidedWizardMergeSectionId.value &&
    !guidedWizardSectionIds.value.includes(guidedWizardMergeSectionId.value)
  ) {
    guidedWizardMergeSectionId.value = "";
  }
};

const onGuidedSectionPlacementChange = (sectionId: string, event: Event) => {
  const placement = (event.target as HTMLSelectElement)
    .value as AIRadioPlacement;
  guidedWizardSectionPlacements.value = {
    ...guidedWizardSectionPlacements.value,
    [sectionId]: placement,
  };
};

const createGuidedSection = async () => {
  if (!guidedNewSectionName.value.trim()) {
    toast.error($t("providers.ai_radio.validation.section_name_required"));
    return;
  }
  if (!guidedNewSectionPrompt.value.trim()) {
    toast.error($t("providers.ai_radio.validation.section_prompt_required"));
    return;
  }

  creatingGuidedSection.value = true;
  try {
    const sectionDraft = normalizeSectionDraft(
      createSectionDraftFromTemplate(),
    );
    sectionDraft.name = guidedNewSectionName.value.trim();
    sectionDraft.id = slugify(sectionDraft.name);
    sectionDraft.type = "ai_text";
    sectionDraft.prompt = guidedNewSectionPrompt.value.trim();
    sectionDraft.web_search = "disabled";
    sectionDraft.constraints = { max_chars: 650 };

    const saved = await saveSection(sectionDraft);
    if (!guidedWizardSectionIds.value.includes(saved.id)) {
      guidedWizardSectionIds.value = [
        ...guidedWizardSectionIds.value,
        saved.id,
      ];
    }
    guidedWizardSectionPlacements.value = {
      ...guidedWizardSectionPlacements.value,
      [saved.id]: guidedNewSectionPlacement.value,
    };

    guidedNewSectionName.value = "";
    guidedNewSectionPrompt.value = "";
    guidedNewSectionPlacement.value = "between_songs";
    toast.success($t("providers.ai_radio.toast.section_added_to_setup"));
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.section_create_failed", [
        errorMessage(error),
      ]),
    );
  } finally {
    creatingGuidedSection.value = false;
  }
};

const buildGuidedSectionOrder = (
  sectionIds: string[],
): AIRadioSectionOrderRule[] => {
  const selectedSections = sectionIds
    .map((sectionId) =>
      sections.value.find((section) => section.id === sectionId),
    )
    .filter((section): section is AIRadioSection => Boolean(section));
  const textSections = selectedSections.filter(
    (section) => section.type === "ai_text",
  );
  if (!textSections.length) {
    return [];
  }

  const rules: AIRadioSectionOrderRule[] = [];
  const placements: AIRadioPlacement[] = [
    "start_of_playlist",
    "between_songs",
    "end_of_playlist",
  ];

  for (const placement of placements) {
    const placementSections = textSections.filter((section) => {
      const selectedPlacement =
        guidedWizardSectionPlacements.value[section.id] || "between_songs";
      return selectedPlacement === placement;
    });

    if (!placementSections.length) {
      continue;
    }

    rules.push({
      when: placement,
      flow: placementSections.map((section) => ({ MUST: section.id })),
    });
  }

  if (!rules.length) {
    rules.push({
      when: "between_songs",
      flow: [{ MUST: textSections[0].id }],
    });
  }
  return rules;
};

const createGuidedStation = async () => {
  if (!canProceedGuidedWizardStep.value && guidedWizardStep.value < 3) {
    toast.error($t("providers.ai_radio.validation.complete_current_step"));
    return;
  }
  if (!guidedWizardStationName.value.trim()) {
    toast.error($t("providers.ai_radio.validation.station_name_required"));
    guidedWizardStep.value = 1;
    return;
  }
  if (!guidedWizardSourcePlaylistSelectValue.value) {
    toast.error($t("providers.ai_radio.validation.source_playlist_required"));
    guidedWizardStep.value = 1;
    return;
  }
  if (!guidedWizardSectionIds.value.length) {
    toast.error($t("providers.ai_radio.validation.select_section"));
    guidedWizardStep.value = 2;
    return;
  }

  creatingGuidedStation.value = true;
  try {
    const draft = normalizeStationDraft(createStationDraftFromTemplate());
    const { provider, itemId } = splitPlaylistSelectValue(
      guidedWizardSourcePlaylistSelectValue.value,
    );
    draft.name = guidedWizardStationName.value.trim();
    draft.id = slugify(draft.name);
    draft.source_playlist_provider = provider;
    draft.source_playlist_id = itemId;
    draft.default_player_id = guidedWizardDefaultPlayerId.value;

    const sectionIds = [...guidedWizardSectionIds.value];
    if (
      guidedWizardMergeSectionId.value &&
      !sectionIds.includes(guidedWizardMergeSectionId.value)
    ) {
      sectionIds.push(guidedWizardMergeSectionId.value);
    }
    draft.section_ids = sectionIds;
    draft.merge_section_id = guidedWizardMergeSectionId.value;
    draft.section_order = buildGuidedSectionOrder(sectionIds);

    const payload = buildStationPayload(draft);
    const localError = validateStationDraftLocal(payload);
    if (localError) {
      toast.error(localError);
      return;
    }

    const saved = await saveStation(payload);
    selectedEditorStationId.value = saved.id;
    stationDraft.value = normalizeStationDraft(saved);
    selectedRunStationId.value = saved.id;
    applyRunStationDefaults(saved.id);
    activeTab.value = "run";
    guidedWizardOpen.value = false;
    toast.success($t("providers.ai_radio.toast.station_created"));
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.guided_station_create_failed", [
        errorMessage(error),
      ]),
    );
  } finally {
    creatingGuidedStation.value = false;
  }
};

const createNewStationDraft = () => {
  const draft = normalizeStationDraft(createStationDraftFromTemplate());
  draft.id = "";
  draft.name = "";
  draft.source_playlist_id = "";
  draft.source_playlist_provider = "library";
  selectedEditorStationId.value = "";
  stationDraft.value = draft;
  activeTab.value = "stations";
};

const selectStationForEdit = async (stationId: string) => {
  try {
    const station = await getStation(stationId);
    selectedEditorStationId.value = station.id;
    stationDraft.value = normalizeStationDraft(station);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.station_load_failed", [errorMessage(error)]),
    );
  }
};

const validateStationDraftLocal = (station: AIRadioStation): string | null => {
  if (!station.name.trim()) {
    return $t("providers.ai_radio.validation.station_name_required");
  }
  if (!station.source_playlist_id.trim()) {
    return $t("providers.ai_radio.validation.station_source_playlist_required");
  }
  if (!station.section_ids?.length) {
    return $t("providers.ai_radio.validation.select_section");
  }
  if (!station.section_order?.length) {
    return $t("providers.ai_radio.validation.section_order_required");
  }

  for (const [ruleIndex, rule] of station.section_order.entries()) {
    if (!Array.isArray(rule.flow) || !rule.flow.length) {
      return $t("providers.ai_radio.validation.rule_requires_flow", [
        ruleIndex + 1,
      ]);
    }
    for (const [flowIndex, item] of rule.flow.entries()) {
      const type = getFlowType(item);
      if (type === "MUST" && !getMustSection(item)) {
        return $t("providers.ai_radio.validation.must_needs_section", [
          ruleIndex + 1,
          flowIndex + 1,
        ]);
      }
      if (type === "ALTERNATIVE") {
        const choices = getAlternativeChoices(item).filter(
          (choice) =>
            choice.section.trim() && parseOptionalNumber(choice.weight) > 0,
        );
        if (!choices.length) {
          return $t("providers.ai_radio.validation.alternative_needs_choice", [
            ruleIndex + 1,
            flowIndex + 1,
          ]);
        }
      }
      if (type === "OPTIONAL" && !getOptionalSection(item)) {
        return $t("providers.ai_radio.validation.optional_needs_section", [
          ruleIndex + 1,
          flowIndex + 1,
        ]);
      }
      if (type === "OPTIONAL" && "OPTIONAL" in item) {
        const chance = (item.OPTIONAL as { chance?: unknown }).chance;
        if (
          chance !== undefined &&
          (typeof chance !== "number" || !Number.isFinite(chance))
        ) {
          return $t("providers.ai_radio.validation.optional_chance_numeric", [
            ruleIndex + 1,
            flowIndex + 1,
          ]);
        }
      }
    }
  }

  return null;
};

const buildStationPayload = (draft: AIRadioStationDraft): AIRadioStation => {
  const station = normalizeStationDraft(deepClone(draft));
  if (!station.id.trim()) {
    station.id = slugify(station.name);
  }
  // Keep station payload section-id based; shared section library is edited separately.
  delete (station as { sections?: AIRadioSection[] }).sections;
  return station;
};

const saveStationDraft = async () => {
  if (!stationDraft.value) {
    return;
  }
  const payload = buildStationPayload(stationDraft.value);
  const localError = validateStationDraftLocal(payload);
  if (localError) {
    toast.error(localError);
    return;
  }
  try {
    const saved = await saveStation(payload);
    selectedEditorStationId.value = saved.id;
    stationDraft.value = normalizeStationDraft(saved);
    if (!selectedRunStationId.value) {
      selectedRunStationId.value = saved.id;
      applyRunStationDefaults(saved.id);
    }
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.station_save_failed", [errorMessage(error)]),
    );
  }
};

const validateStationDraftOnServer = async () => {
  if (!stationDraft.value) {
    return;
  }
  const payload = buildStationPayload(stationDraft.value);
  const localError = validateStationDraftLocal(payload);
  if (localError) {
    toast.error(localError);
    return;
  }
  try {
    const normalized = await validateStation(payload);
    stationDraft.value = normalizeStationDraft(normalized);
    toast.success($t("providers.ai_radio.toast.station_validation_passed"));
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.station_validation_failed", [
        errorMessage(error),
      ]),
    );
  }
};

const removeSelectedStation = async () => {
  if (!selectedEditorStationId.value) {
    return;
  }
  if (!window.confirm($t("providers.ai_radio.confirm.delete_station"))) {
    return;
  }
  try {
    await deleteStation(selectedEditorStationId.value);
    const nextStation = stations.value[0];
    if (nextStation) {
      await selectStationForEdit(nextStation.id);
    } else {
      selectedEditorStationId.value = "";
      stationDraft.value = null;
    }
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.station_delete_failed", [
        errorMessage(error),
      ]),
    );
  }
};

const triggerStationImport = () => {
  stationImportInput.value?.click();
};

const onStationImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const data = JSON.parse(await file.text()) as Record<string, unknown>;
    let imported: AIRadioStation | null = null;
    if (Array.isArray(data.stations) && data.stations.length > 0) {
      imported = data.stations[0] as unknown as AIRadioStation;
    } else {
      imported = data as unknown as AIRadioStation;
    }
    stationDraft.value = normalizeStationDraft(imported);
    selectedEditorStationId.value = stationDraft.value.id || "";
    activeTab.value = "stations";
    toast.success($t("providers.ai_radio.toast.station_imported"));
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.station_import_failed", [
        errorMessage(error),
      ]),
    );
  } finally {
    target.value = "";
  }
};

const exportJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const exportStationDraft = () => {
  if (!stationDraft.value) {
    toast.error($t("providers.ai_radio.validation.no_station_loaded"));
    return;
  }
  const payload = buildStationPayload(stationDraft.value);
  const fileName = `${payload.id || slugify(payload.name)}.json`;
  exportJson(fileName, payload);
  toast.success($t("providers.ai_radio.toast.station_exported"));
};

const createNewSectionDraft = () => {
  const draft = normalizeSectionDraft(createSectionDraftFromTemplate());
  draft.id = "";
  draft.name = "";
  draft.prompt = "";
  selectedEditorSectionId.value = "";
  sectionDraft.value = draft;
  activeTab.value = "sections";
};

const selectSectionForEdit = async (sectionId: string) => {
  try {
    const section = await getSection(sectionId);
    selectedEditorSectionId.value = section.id;
    sectionDraft.value = normalizeSectionDraft(section);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.section_load_failed", [errorMessage(error)]),
    );
  }
};

const saveSectionDraft = async () => {
  if (!sectionDraft.value) {
    return;
  }
  const payload = normalizeSectionDraft(deepClone(sectionDraft.value));
  if (!payload.name.trim()) {
    toast.error($t("providers.ai_radio.validation.section_name_required"));
    return;
  }
  if (!payload.id.trim()) {
    payload.id = slugify(payload.name);
  }
  if (!payload.prompt.trim()) {
    toast.error($t("providers.ai_radio.validation.section_prompt_required"));
    return;
  }
  if (payload.type !== "ai_text") {
    delete (payload as { web_search?: string }).web_search;
    delete (payload as { constraints?: { max_chars?: number } }).constraints;
  }
  try {
    const saved = await saveSection(payload);
    selectedEditorSectionId.value = saved.id;
    sectionDraft.value = normalizeSectionDraft(saved);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.section_save_failed", [errorMessage(error)]),
    );
  }
};

const removeSelectedSection = async () => {
  if (!selectedEditorSectionId.value) {
    return;
  }
  if (!window.confirm($t("providers.ai_radio.confirm.delete_section"))) {
    return;
  }
  try {
    await deleteSection(selectedEditorSectionId.value);
    const nextSection = sections.value[0];
    if (nextSection) {
      await selectSectionForEdit(nextSection.id);
    } else {
      selectedEditorSectionId.value = "";
      sectionDraft.value = null;
    }
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.section_delete_failed", [
        errorMessage(error),
      ]),
    );
  }
};

const triggerSectionImport = () => {
  sectionImportInput.value?.click();
};

const onSectionImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const data = JSON.parse(await file.text()) as Record<string, unknown>;
    let imported: AIRadioSection | null = null;
    if (Array.isArray(data.sections) && data.sections.length > 0) {
      imported = data.sections[0] as unknown as AIRadioSection;
    } else {
      imported = data as unknown as AIRadioSection;
    }
    sectionDraft.value = normalizeSectionDraft(imported);
    selectedEditorSectionId.value = sectionDraft.value.id || "";
    activeTab.value = "sections";
    toast.success($t("providers.ai_radio.toast.section_imported"));
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.section_import_failed", [
        errorMessage(error),
      ]),
    );
  } finally {
    target.value = "";
  }
};

const exportSectionDraft = () => {
  if (!sectionDraft.value) {
    toast.error($t("providers.ai_radio.validation.no_section_loaded"));
    return;
  }
  const payload = normalizeSectionDraft(sectionDraft.value);
  const fileName = `${payload.id || slugify(payload.name)}.json`;
  exportJson(fileName, payload);
  toast.success($t("providers.ai_radio.toast.section_exported"));
};

const onSectionMaxCharsChange = (value: string | number) => {
  if (!sectionDraft.value) {
    return;
  }
  if (!sectionDraft.value.constraints) {
    sectionDraft.value.constraints = { max_chars: 0 };
  }
  sectionDraft.value.constraints.max_chars = safeInteger(String(value), 0, 0);
};

const onStationSectionIdsChange = (event: Event) => {
  if (!stationDraft.value) {
    return;
  }
  const target = event.target as HTMLSelectElement;
  stationDraft.value.section_ids = Array.from(target.selectedOptions).map(
    (item) => item.value,
  );
  if (
    stationDraft.value.merge_section_id &&
    !stationDraft.value.section_ids.includes(
      stationDraft.value.merge_section_id,
    )
  ) {
    stationDraft.value.merge_section_id = "";
  }
};

const addOrderRule = () => {
  if (!stationDraft.value) {
    return;
  }
  if (!stationDraft.value.section_order) {
    stationDraft.value.section_order = [];
  }
  stationDraft.value.section_order.push({
    when: "between_songs",
    flow: [{ MUST: "" }],
  });
};

const moveOrderRule = (index: number, direction: -1 | 1) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const target = index + direction;
  if (target < 0 || target >= stationDraft.value.section_order.length) {
    return;
  }
  const current = stationDraft.value.section_order[index];
  stationDraft.value.section_order[index] =
    stationDraft.value.section_order[target];
  stationDraft.value.section_order[target] = current;
};

const removeOrderRule = (index: number) => {
  stationDraft.value?.section_order?.splice(index, 1);
};

const onOrderPlacementChange = (ruleIndex: number, event: Event) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const value = (event.target as HTMLSelectElement)
    .value as AIRadioSectionOrderRule["when"];
  stationDraft.value.section_order[ruleIndex].when = value;
};

const getFlowType = (item: AIRadioFlowItem): AIRadioFlowType => {
  if ("MUST" in item) {
    return "MUST";
  }
  if ("ALTERNATIVE" in item) {
    return "ALTERNATIVE";
  }
  return "OPTIONAL";
};

const makeDefaultFlowItem = (type: AIRadioFlowType): AIRadioFlowItem => {
  if (type === "MUST") {
    return { MUST: "" };
  }
  if (type === "ALTERNATIVE") {
    return {
      ALTERNATIVE: {
        choices: [{ section: "", weight: 1 }],
      },
    };
  }
  return {
    OPTIONAL: {
      section: "",
      chance: 0.5,
      guards: {
        min_gap_songs: 0,
        max_per_60min: 0,
        require_placeholders_present: [],
      },
    },
  };
};

const addFlowItem = (ruleIndex: number) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  stationDraft.value.section_order[ruleIndex].flow.push(
    makeDefaultFlowItem("MUST"),
  );
};

const removeFlowItem = (ruleIndex: number, flowIndex: number) => {
  stationDraft.value?.section_order?.[ruleIndex]?.flow.splice(flowIndex, 1);
};

const onFlowTypeChange = (
  ruleIndex: number,
  flowIndex: number,
  event: Event,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const type = (event.target as HTMLSelectElement).value as AIRadioFlowType;
  stationDraft.value.section_order[ruleIndex].flow[flowIndex] =
    makeDefaultFlowItem(type);
};

const getMustSection = (item: AIRadioFlowItem): string => {
  if ("MUST" in item) {
    return item.MUST;
  }
  return "";
};

const onMustSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  event: Event,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("MUST" in flow)) {
    return;
  }
  flow.MUST = (event.target as HTMLSelectElement).value;
};

const getAlternativeChoices = (
  item: AIRadioFlowItem,
): AIRadioAlternativeChoice[] => {
  if ("ALTERNATIVE" in item) {
    return item.ALTERNATIVE.choices;
  }
  return [];
};

const addAlternativeChoice = (ruleIndex: number, flowIndex: number) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices.push({ section: "", weight: 1 });
};

const removeAlternativeChoice = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices.splice(choiceIndex, 1);
};

const onAlternativeChoiceSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
  event: Event,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices[choiceIndex].section = (
    event.target as HTMLSelectElement
  ).value;
};

const onAlternativeChoiceWeightChange = (
  ruleIndex: number,
  flowIndex: number,
  choiceIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  if (!("ALTERNATIVE" in flow)) {
    return;
  }
  flow.ALTERNATIVE.choices[choiceIndex].weight = safeNumber(
    String(value),
    0,
    0,
  );
};

const getOptionalPayload = (
  item: AIRadioFlowItem,
): {
  section: string;
  chance?: number;
  guards?: AIRadioOptionalGuards;
} | null => {
  if ("OPTIONAL" in item) {
    if (!item.OPTIONAL.guards) {
      item.OPTIONAL.guards = {
        min_gap_songs: 0,
        max_per_60min: 0,
        require_placeholders_present: [],
      };
    }
    return item.OPTIONAL;
  }
  return null;
};

const getOptionalSection = (item: AIRadioFlowItem): string => {
  const optional = getOptionalPayload(item);
  return optional?.section || "";
};

const onOptionalSectionChange = (
  ruleIndex: number,
  flowIndex: number,
  event: Event,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional) {
    return;
  }
  optional.section = (event.target as HTMLSelectElement).value;
};

const getOptionalChancePercent = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return Math.round((optional?.chance ?? 0) * 100);
};

const onOptionalChanceChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional) {
    return;
  }
  const percent = safeNumber(String(value), 0, 0);
  optional.chance = Math.min(percent, 100) / 100;
};

const getOptionalMinGap = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return safeInteger(String(optional?.guards?.min_gap_songs ?? 0), 0, 0);
};

const onOptionalMinGapChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.min_gap_songs = safeInteger(String(value), 0, 0);
};

const getOptionalMaxPer60 = (item: AIRadioFlowItem): number => {
  const optional = getOptionalPayload(item);
  return safeInteger(String(optional?.guards?.max_per_60min ?? 0), 0, 0);
};

const onOptionalMaxPerChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.max_per_60min = safeInteger(String(value), 0, 0);
};

const getOptionalPlaceholders = (item: AIRadioFlowItem): string => {
  const optional = getOptionalPayload(item);
  return (optional?.guards?.require_placeholders_present || []).join(", ");
};

const onOptionalPlaceholdersChange = (
  ruleIndex: number,
  flowIndex: number,
  value: string | number,
) => {
  if (!stationDraft.value?.section_order) {
    return;
  }
  const flow = stationDraft.value.section_order[ruleIndex].flow[flowIndex];
  const optional = getOptionalPayload(flow);
  if (!optional?.guards) {
    return;
  }
  optional.guards.require_placeholders_present = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

onMounted(async () => {
  try {
    await Promise.all([refreshEditor(true), loadStatus(true)]);

    if (!localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY)) {
      tutorialOpen.value = true;
    }

    if (stations.value.length > 0) {
      if (!selectedEditorStationId.value) {
        await selectStationForEdit(stations.value[0].id);
      }
      if (!selectedRunStationId.value) {
        selectedRunStationId.value = stations.value[0].id;
        applyRunStationDefaults(stations.value[0].id);
      }
    }

    if (sections.value.length > 0 && !selectedEditorSectionId.value) {
      await selectSectionForEdit(sections.value[0].id);
    }

    applyRouteOverrides();

    refreshTimer = setInterval(() => {
      void loadStatus(true).catch(() => undefined);
    }, AUTO_REFRESH_MS);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.init_failed", [errorMessage(error)]),
    );
  }
});

watch(
  () => route.query,
  () => {
    applyRouteOverrides();
  },
);

watch(stations, async (nextStations) => {
  if (nextStations.length === 0) {
    selectedEditorStationId.value = "";
    stationDraft.value = null;
    selectedRunStationId.value = "";
    return;
  }

  if (
    selectedEditorStationId.value &&
    !nextStations.some(
      (station) => station.id === selectedEditorStationId.value,
    )
  ) {
    await selectStationForEdit(nextStations[0].id);
  }

  if (
    selectedRunStationId.value &&
    !nextStations.some((station) => station.id === selectedRunStationId.value)
  ) {
    selectedRunStationId.value = nextStations[0].id;
    applyRunStationDefaults(nextStations[0].id);
  }

  applyRouteOverrides();
});

watch(sections, async (nextSections) => {
  if (nextSections.length === 0) {
    selectedEditorSectionId.value = "";
    sectionDraft.value = null;
    return;
  }

  if (
    selectedEditorSectionId.value &&
    !nextSections.some(
      (section) => section.id === selectedEditorSectionId.value,
    )
  ) {
    await selectSectionForEdit(nextSections[0].id);
  }
});

onBeforeUnmount(() => {
  if (!refreshTimer) {
    return;
  }
  clearInterval(refreshTimer);
  refreshTimer = null;
});
</script>
