import {
  type BackgroundTask,
  type CommandMessage,
  CoreState,
  type DSPConfig,
  type ErrorResultMessage,
  MatchPolicy,
  type ServerInfoMessage,
  type SuccessResultMessage,
  TaskStatus,
} from "@/plugins/api/interfaces";
import { BaseTransport, TransportState } from "@/plugins/remote/transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockToastError, mockToastInfo } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: mockToastError,
    info: mockToastInfo,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

vi.mock("@/plugins/store", () => ({
  store: {},
}));

import {
  ApiCommandError,
  ConnectionLostError,
  ConnectionState,
  MusicAssistantApi,
} from "@/plugins/api";

const SERVER_INFO: ServerInfoMessage = {
  server_id: "test-server",
  server_version: "0.0.0",
  schema_version: 0,
  min_supported_schema_version: 0,
  name: null,
  base_url: "http://test.local",
  homeassistant_addon: false,
  onboard_done: true,
  status: CoreState.RUNNING,
};

class TestTransport extends BaseTransport {
  readonly sentCommands: CommandMessage[] = [];

  connect(): Promise<void> {
    this.setState(TransportState.CONNECTED);
    return Promise.resolve();
  }

  disconnect(): void {
    this.setState(TransportState.DISCONNECTED);
  }

  send(data: string): void {
    this.sentCommands.push(JSON.parse(data) as CommandMessage);
  }

  /**
   * Simulate the socket dropping. The real transports move to a disconnected
   * state before emitting close, so mirror that order here.
   */
  close(reason = "connection lost"): void {
    this.setState(TransportState.DISCONNECTED);
    this.emit("close", reason);
  }

  receive(
    message: ServerInfoMessage | SuccessResultMessage | ErrorResultMessage,
  ): void {
    this.emit("message", JSON.stringify(message));
  }

  get lastCommand(): CommandMessage {
    const command = this.sentCommands.at(-1);
    if (!command) throw new Error("No command was sent");
    return command;
  }
}

describe("MusicAssistantApi error handling", () => {
  let api: MusicAssistantApi;
  let transport: TestTransport;

  beforeEach(async () => {
    vi.clearAllMocks();
    api = new MusicAssistantApi();
    transport = new TestTransport();
    const initialization = api.initialize(transport);
    transport.receive(SERVER_INFO);
    await initialization;
    expect(api.state.value).toBe(ConnectionState.CONNECTED);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects suppressed errors without global logging or a toast", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleDebug = vi
      .spyOn(console, "debug")
      .mockImplementation(() => {});
    const command = api.sendCommand("test/suppressed", undefined, {
      suppressGlobalError: true,
    });
    const error = createErrorResult(
      transport.lastCommand,
      "Suppressed failure",
    );
    const rejection = expect(command).rejects.toMatchObject({
      message: "Suppressed failure",
      error_code: 999,
    });

    transport.receive(error);

    await rejection;
    expect(consoleError).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(consoleDebug).toHaveBeenCalledWith("[resultMessage]", error);
  });

  it("keeps global logging and the toast for ordinary errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleDebug = vi
      .spyOn(console, "debug")
      .mockImplementation(() => {});
    const command = api.sendCommand("test/ordinary");
    const error = createErrorResult(transport.lastCommand, "Visible failure");
    const rejection = expect(command).rejects.toMatchObject({
      message: "Visible failure",
      error_code: 999,
    });

    transport.receive(error);

    await rejection;
    expect(consoleError).toHaveBeenCalledWith("[resultMessage]", error);
    expect(mockToastError).toHaveBeenCalledWith("Visible failure");
    expect(consoleDebug).not.toHaveBeenCalled();
  });

  it("rejects with the server error code and renders as the plain message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const command = api.sendCommand("test/coded");

    transport.receive(createErrorResult(transport.lastCommand, "Boom"));

    const err = await command.catch((reason: unknown) => reason);
    expect(err).toBeInstanceOf(ApiCommandError);
    expect((err as ApiCommandError).error_code).toBe(999);
    expect(String(err)).toBe("Boom");
    expect(`${err}`).toBe("Boom");
  });

  it("falls back to the error code when the server sends no details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const command = api.sendCommand("test/no-details");

    transport.receive({
      message_id: transport.lastCommand.message_id!,
      error_code: 1001,
      details: null,
    });

    await expect(command).rejects.toMatchObject({
      message: "1001",
      error_code: 1001,
    });
  });

  it("applies a DSP preset through the dedicated command", async () => {
    const config: DSPConfig = {
      enabled: true,
      filters: [],
      input_gain: 0,
      output_gain: 0,
      preset_id: "preset-1",
    };
    const result = api.applyDSPPreset("player-1", "preset-1");

    expect(transport.lastCommand.command).toBe(
      "config/players/dsp/apply_preset",
    );
    expect(transport.lastCommand.args).toEqual({
      player_id: "player-1",
      preset_id: "preset-1",
    });

    transport.receive({
      message_id: transport.lastCommand.message_id!,
      result: config,
      partial: false,
    });
    await expect(result).resolves.toEqual(config);
  });

  it("migrates a playlist and notifies the background task toast", async () => {
    const task: BackgroundTask = {
      id: "task-1",
      name: "Migrate playlist",
      status: TaskStatus.PENDING,
      logs: [],
      schedule: null,
      last_run: null,
      next_run: null,
      user_id: null,
      last_run_user_id: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      started_at: null,
      finished_at: null,
      last_error: null,
      failure_count: 0,
      failure_messages: [],
      metadata: {},
      progress: null,
      progress_text: null,
      allow_retry: false,
      allow_cancel: true,
    };
    const result = api.migratePlaylist(
      "1",
      "spotify--1",
      MatchPolicy.SAME_RECORDING,
      "My playlist",
    );

    expect(transport.lastCommand.command).toBe(
      "music/playlists/migrate_playlist",
    );
    expect(transport.lastCommand.args).toEqual({
      db_playlist_id: "1",
      destination_provider: "spotify--1",
      match_policy: MatchPolicy.SAME_RECORDING,
      name: "My playlist",
    });

    transport.receive({
      message_id: transport.lastCommand.message_id!,
      result: task,
      partial: false,
    });
    await expect(result).resolves.toEqual(task);
    expect(mockToastInfo).toHaveBeenCalledWith(
      "background_tasks.toast.added",
      expect.anything(),
    );
  });

  it("reports playlist migration support once the server reaches schema 56", () => {
    expect(api.supportsPlaylistMigration).toBe(false);

    api.serverInfo.value = { ...SERVER_INFO, schema_version: 56 };
    expect(api.supportsPlaylistMigration).toBe(true);

    api.serverInfo.value = { ...SERVER_INFO, schema_version: 55 };
    expect(api.supportsPlaylistMigration).toBe(false);
  });

  it("rejects in-flight commands when the connection closes", async () => {
    const command = api.sendCommand("test/pending");
    const rejection =
      expect(command).rejects.toBeInstanceOf(ConnectionLostError);

    // a dropped socket emits close; the result can never arrive afterwards
    transport.close();

    await rejection;
  });

  it("rejects in-flight commands on an explicit disconnect", async () => {
    const command = api.sendCommand("test/pending");
    const rejection =
      expect(command).rejects.toBeInstanceOf(ConnectionLostError);

    api.disconnect();

    await rejection;
  });
});

function createErrorResult(
  command: CommandMessage,
  details: string,
): ErrorResultMessage {
  if (!command.message_id) throw new Error("Command has no message ID");
  return {
    message_id: command.message_id,
    error_code: 999,
    details,
  };
}
