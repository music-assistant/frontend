// Resonate Protocol Types and Interfaces

export enum MessageType {
  CLIENT_HELLO = "client/hello",
  SERVER_HELLO = "server/hello",
  CLIENT_TIME = "client/time",
  SERVER_TIME = "server/time",
  CLIENT_STATE = "client/state",
  SERVER_STATE = "server/state",
  SERVER_COMMAND = "server/command",
  STREAM_START = "stream/start",
  STREAM_UPDATE = "stream/update",
  STREAM_REQUEST_FORMAT = "stream/request-format",
  STREAM_END = "stream/end",
  GROUP_UPDATE = "group/update",
}

export interface ClientHello {
  type: MessageType.CLIENT_HELLO;
  payload: {
    client_id: string;
    name: string;
    version: number;
    supported_roles: string[];
    device_info?: {
      product_name?: string;
      manufacturer?: string;
      software_version?: string;
    };
    player_support?: {
      supported_formats: Array<{
        codec: string;
        channels: number;
        sample_rate: number;
        bit_depth: number;
      }>;
      buffer_capacity: number;
      supported_commands: string[];
    };
  };
}

export interface ClientTime {
  type: MessageType.CLIENT_TIME;
  payload: {
    client_transmitted: number;
  };
}

export interface ClientState {
  type: MessageType.CLIENT_STATE;
  payload: {
    player?: {
      state: "synchronized" | "error";
      volume: number;
      muted: boolean;
    };
  };
}

export interface ServerHello {
  type: MessageType.SERVER_HELLO;
  payload: Record<string, unknown>;
}

export interface ServerTime {
  type: MessageType.SERVER_TIME;
  payload: {
    client_transmitted: number;
    server_received: number;
    server_transmitted: number;
  };
}

export interface ServerState {
  type: MessageType.SERVER_STATE;
  payload: Record<string, unknown>;
}

export interface StreamStart {
  type: MessageType.STREAM_START;
  payload: {
    player: {
      codec: string;
      sample_rate: number;
      channels: number;
      bit_depth?: number;
      codec_header?: string;
    };
  };
}

export interface StreamUpdate {
  type: MessageType.STREAM_UPDATE;
  payload: {
    player?: {
      codec?: string;
      sample_rate?: number;
      channels?: number;
      bit_depth?: number;
      codec_header?: string;
    };
  };
}

export interface StreamEnd {
  type: MessageType.STREAM_END;
  payload: Record<string, unknown>;
}

export interface ServerCommand {
  type: MessageType.SERVER_COMMAND;
  payload: {
    player: {
      command: "volume" | "mute";
      volume?: number;
      mute?: boolean;
    };
  };
}

export interface GroupUpdate {
  type: MessageType.GROUP_UPDATE;
  payload: Record<string, unknown>;
}

export type ServerMessage =
  | ServerHello
  | ServerTime
  | ServerState
  | StreamStart
  | StreamUpdate
  | StreamEnd
  | ServerCommand
  | GroupUpdate;

export type ClientMessage = ClientHello | ClientTime | ClientState;

export type StreamFormat = {
  codec: string;
  sample_rate: number;
  channels: number;
  bit_depth?: number;
  codec_header?: string;
};

export type PlayerState = "synchronized" | "error";

export interface ResonatePlayerConfig {
  playerId: string;
  baseUrl: string;
  audioElement: HTMLAudioElement;
  isAndroid: boolean;
  onStateChange?: (state: {
    isPlaying: boolean;
    volume: number;
    muted: boolean;
    playerState: PlayerState;
  }) => void;
}

export interface AudioBufferQueueItem {
  buffer: AudioBuffer;
  serverTime: number;
}
