import {
  type CommandMessage,
  CoreState,
  type DSPConfig,
  type ErrorResultMessage,
  type Player,
  PlaylistMatchPolicy,
  RepeatMode,
  type ServerInfoMessage,
  type SuccessResultMessage,
} from "@/plugins/api/interfaces";
import { BaseTransport, TransportState } from "@/plugins/remote/transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../../fixtures/playlist";

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
  internal_url: "http://test.local",
  external_url: null,
  has_remote_access: false,
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

  // the server refuses a command whose source is no longer playing, so both
  // carry the source they were aimed at
  it("names the source a shuffle or repeat was aimed at", () => {
    api.playerCommandShuffle("player-1", true, "spotify://audio_source/main");

    expect(transport.lastCommand.command).toBe("players/cmd/shuffle");
    expect(transport.lastCommand.args).toEqual({
      player_id: "player-1",
      shuffle_enabled: true,
      source_id: "spotify://audio_source/main",
    });

    api.playerCommandRepeat("player-1", RepeatMode.ALL, "player-1");

    expect(transport.lastCommand.command).toBe("players/cmd/repeat");
    expect(transport.lastCommand.args).toEqual({
      player_id: "player-1",
      repeat_mode: RepeatMode.ALL,
      source_id: "player-1",
    });
  });

  describe("a refused ordering command", () => {
    // the server refuses every one of these with the same code and the same
    // localized "the command failed", so the player's own state is what tells
    // the guard doing its job apart from something that actually went wrong
    const playerOn = (activeSource: string | null) => {
      api.players["player-1"] = {
        player_id: "player-1",
        active_source: activeSource,
      } as Player;
    };

    const refuse = () => {
      const consoleDebug = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      transport.receive(
        createErrorResult(transport.lastCommand, "The command failed."),
      );
      return { consoleDebug, consoleError };
    };

    // the control was aimed at something that stopped playing, so the refusal
    // is expected; putting it in front of the user would only confuse
    it.each([
      ["shuffle", () => api.playerCommandShuffle("player-1", true, "gone")],
      [
        "repeat",
        () => api.playerCommandRepeat("player-1", RepeatMode.ALL, "gone"),
      ],
    ])("stays quiet when the player moved on (%s)", async (_name, send) => {
      playerOn("took-over");
      const command = send();

      const { consoleDebug, consoleError } = refuse();

      await expect(command).resolves.toBeUndefined();
      expect(consoleError).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
      // the quiet branch ran, rather than the error never being handled at all
      expect(consoleDebug).toHaveBeenCalled();
    });

    // still the source it was aimed at, so something genuinely went wrong
    // (a device or provider error) and the user deserves to hear about it
    it.each([
      ["shuffle", () => api.playerCommandShuffle("player-1", true, "playing")],
      [
        "repeat",
        () => api.playerCommandRepeat("player-1", RepeatMode.ALL, "playing"),
      ],
    ])("surfaces a real failure (%s)", async (_name, send) => {
      playerOn("playing");
      const command = send();

      const { consoleError } = refuse();

      await expect(command).resolves.toBeUndefined();
      expect(consoleError).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith("The command failed.");
    });

    // the whole point: the source moves between the click and the reply, so a
    // decision taken when the command was sent would get this backwards
    it("decides when the refusal arrives, not when the command was sent", async () => {
      playerOn("playing");
      const command = api.playerCommandShuffle("player-1", true, "playing");

      playerOn("took-over");
      const { consoleError } = refuse();

      await expect(command).resolves.toBeUndefined();
      expect(consoleError).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    // a player playing nothing but its own queue reports no active_source, and
    // the server resolves that to the player's own id — so the id the control
    // named still matches and the failure is real
    it("surfaces a real failure on a player's own queue", async () => {
      playerOn(null);
      const command = api.playerCommandShuffle("player-1", true, "player-1");

      refuse();

      await expect(command).resolves.toBeUndefined();
      expect(mockToastError).toHaveBeenCalledWith("The command failed.");
    });

    it("stays quiet when a player fell back to its own queue", async () => {
      playerOn(null);
      const command = api.playerCommandShuffle("player-1", true, "gone");

      const { consoleError } = refuse();

      await expect(command).resolves.toBeUndefined();
      expect(consoleError).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });

    // nothing to compare against, so fall back to telling the user
    it("surfaces a failure for a player it does not know", async () => {
      const command = api.playerCommandShuffle("player-1", true, "gone");

      refuse();

      await expect(command).resolves.toBeUndefined();
      expect(mockToastError).toHaveBeenCalledWith("The command failed.");
    });
  });

  // the predicate runs inside the message pump, so a throwing one must not take
  // the reply (or the command waiting on it) with it
  it("surfaces the failure when a suppression predicate throws", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const command = api.sendCommand("test/throwing", undefined, {
      suppressGlobalError: () => {
        throw new Error("predicate blew up");
      },
    });
    const rejection = expect(command).rejects.toMatchObject({
      message: "Visible failure",
    });

    transport.receive(
      createErrorResult(transport.lastCommand, "Visible failure"),
    );

    await rejection;
    expect(mockToastError).toHaveBeenCalledWith("Visible failure");
    expect(consoleError).toHaveBeenCalledWith(
      "[resultMessage] suppression check failed",
      expect.any(Error),
    );
    expect(api["commands"].size).toBe(0);
  });

  it("imports a playlist with the chosen match policy", async () => {
    api.serverInfo.value = { ...SERVER_INFO, schema_version: 59 };
    const result = api.importPlaylist(
      "#EXTM3U",
      true,
      ["spotify--1"],
      PlaylistMatchPolicy.EXACT,
    );

    expect(transport.lastCommand.command).toBe(
      "music/playlists/import_playlist",
    );
    expect(transport.lastCommand.args).toEqual({
      m3u_data: "#EXTM3U",
      library_matching: true,
      match_providers: ["spotify--1"],
      match_policy: PlaylistMatchPolicy.EXACT,
    });

    const importedPlaylist = playlist({ item_id: "1", name: "My playlist" });
    transport.receive({
      message_id: transport.lastCommand.message_id!,
      result: importedPlaylist,
      partial: false,
    });
    await expect(result).resolves.toEqual(importedPlaylist);
  });

  it("omits match_policy when it isn't provided", () => {
    api.importPlaylist("#EXTM3U", true, ["spotify--1"]);

    expect(transport.lastCommand.args).toEqual({
      m3u_data: "#EXTM3U",
      library_matching: true,
      match_providers: ["spotify--1"],
    });
  });

  it("reports playlist match policy support once the server reaches schema 59", () => {
    expect(api.supportsPlaylistMatchPolicy).toBe(false);

    api.serverInfo.value = { ...SERVER_INFO, schema_version: 59 };
    expect(api.supportsPlaylistMatchPolicy).toBe(true);

    api.serverInfo.value = { ...SERVER_INFO, schema_version: 58 };
    expect(api.supportsPlaylistMatchPolicy).toBe(false);
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
