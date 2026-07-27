import {
  type CommandMessage,
  type DSPConfig,
  type ErrorResultMessage,
  type ServerInfoMessage,
  type SuccessResultMessage,
} from "@/plugins/api/interfaces";
import { BaseTransport, TransportState } from "@/plugins/remote/transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockToastError } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: mockToastError,
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

import { ConnectionState, MusicAssistantApi } from "@/plugins/api";

const SERVER_INFO: ServerInfoMessage = {
  server_id: "test-server",
  server_version: "0.0.0",
  schema_version: 0,
  min_supported_schema_version: 0,
  base_url: "http://test.local",
  homeassistant_addon: false,
  onboard_done: true,
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
    const rejection = expect(command).rejects.toBe("Suppressed failure");

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
    const rejection = expect(command).rejects.toBe("Visible failure");

    transport.receive(error);

    await rejection;
    expect(consoleError).toHaveBeenCalledWith("[resultMessage]", error);
    expect(mockToastError).toHaveBeenCalledWith("Visible failure");
    expect(consoleDebug).not.toHaveBeenCalled();
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
    });
    await expect(result).resolves.toEqual(config);
  });
});

function createErrorResult(
  command: CommandMessage,
  details: string,
): ErrorResultMessage {
  if (!command.message_id) throw new Error("Command has no message ID");
  return {
    message_id: command.message_id,
    error_code: "test_error",
    details,
  };
}
