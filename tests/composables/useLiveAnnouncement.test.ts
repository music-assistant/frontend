import { $t } from "@/plugins/i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    baseUrl: "https://music.example",
    isRemoteConnection: { value: false },
  },
  storeMock: { isIngressSession: false },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/auth", () => ({
  authManager: { getToken: () => "session-token" },
}));

import {
  liveAnnouncementSupported,
  useLiveAnnouncement,
} from "@/composables/useLiveAnnouncement";

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.OPEN;
  sent: (string | ArrayBuffer)[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  connect(): void {
    this.onopen?.();
  }

  receive(message: Record<string, unknown>): void {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }

  reject(code: number, reason: string): void {
    this.onclose?.({ code, reason } as CloseEvent);
  }
}

class FakeAudioNode {
  connect = vi.fn((node: unknown) => node);
  disconnect = vi.fn();
}

class FakeAudioWorkletNode extends FakeAudioNode {
  static last: FakeAudioWorkletNode | null = null;

  port: { onmessage: ((event: MessageEvent) => void) | null } = {
    onmessage: null,
  };

  constructor() {
    super();
    FakeAudioWorkletNode.last = this;
  }

  record(frame: ArrayBuffer): void {
    this.port.onmessage?.({ data: frame } as MessageEvent);
  }
}

class FakeAudioContext {
  static last: FakeAudioContext | null = null;

  sampleRate = 48000;
  state = "running";
  destination = new FakeAudioNode();
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  close = vi.fn().mockResolvedValue(undefined);
  resume = vi.fn().mockResolvedValue(undefined);
  createMediaStreamSource = vi.fn(() => new FakeAudioNode());
  createGain = vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() }));

  constructor() {
    FakeAudioContext.last = this;
  }
}

const microphoneTrack = { stop: vi.fn() };
const getUserMedia = vi.fn();
const onFinished = vi.fn();
const onError = vi.fn();

function socket(): FakeWebSocket {
  return FakeWebSocket.instances[0];
}

function worklet(): FakeAudioWorkletNode {
  return FakeAudioWorkletNode.last!;
}

/** Start a clip and take it up to the point where the server accepts audio. */
async function startAccepted() {
  const live = useLiveAnnouncement({ onFinished, onError });
  await live.start("kitchen", true);
  socket().connect();
  socket().receive({ type: "started" });
  return live;
}

describe("useLiveAnnouncement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    FakeAudioWorkletNode.last = null;
    FakeAudioContext.last = null;
    apiMock.baseUrl = "https://music.example";
    apiMock.isRemoteConnection.value = false;
    storeMock.isIngressSession = false;
    getUserMedia.mockResolvedValue({ getTracks: () => [microphoneTrack] });
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:live-announcement");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("announces the clip and streams what was recorded while connecting", async () => {
    const live = useLiveAnnouncement({ onFinished, onError });
    await live.start("kitchen", true);

    expect(socket().url).toBe("wss://music.example/live_announcement");
    socket().connect();
    expect(JSON.parse(socket().sent[0] as string)).toEqual({
      type: "auth",
      token: "session-token",
    });
    expect(JSON.parse(socket().sent[1] as string)).toEqual({
      type: "start",
      player_id: "kitchen",
      sample_rate: 48000,
      channels: 1,
      pre_announce: true,
      volume_level: null,
    });

    const firstWord = new ArrayBuffer(8);
    worklet().record(firstWord);
    expect(socket().sent).toHaveLength(2);

    socket().receive({ type: "started" });
    expect(socket().sent[2]).toBe(firstWord);
    expect(live.state.value).toBe("recording");

    const rest = new ArrayBuffer(8);
    worklet().record(rest);
    expect(socket().sent[3]).toBe(rest);

    live.cancel();
  });

  it("skips the auth message on an ingress session", async () => {
    storeMock.isIngressSession = true;
    const live = useLiveAnnouncement({ onFinished, onError });
    await live.start("kitchen", false);
    socket().connect();

    expect(JSON.parse(socket().sent[0] as string)).toMatchObject({
      type: "start",
      pre_announce: false,
    });

    live.cancel();
  });

  it("hands the microphone back the moment the clip is stopped", async () => {
    const live = await startAccepted();

    live.stop();

    expect(microphoneTrack.stop).toHaveBeenCalled();
    expect(FakeAudioContext.last!.close).toHaveBeenCalled();
    expect(worklet().port.onmessage).toBeNull();
    expect(JSON.parse(socket().sent.at(-1) as string)).toEqual({
      type: "stop",
    });
    expect(live.state.value).toBe("finishing");

    socket().receive({ type: "finished" });

    expect(onFinished).toHaveBeenCalled();
    expect(socket().closed).toBe(true);
    expect(live.state.value).toBe("idle");
  });

  it("still sends the recording when the button is released early", async () => {
    const live = useLiveAnnouncement({ onFinished, onError });
    await live.start("kitchen", true);
    socket().connect();

    const spoken = new ArrayBuffer(8);
    worklet().record(spoken);
    live.stop();

    expect(microphoneTrack.stop).toHaveBeenCalled();
    expect(socket().sent).toHaveLength(2);

    socket().receive({ type: "started" });

    expect(socket().sent[2]).toBe(spoken);
    expect(JSON.parse(socket().sent[3] as string)).toEqual({ type: "stop" });
    expect(live.state.value).toBe("finishing");
  });

  it("announces nothing when the press ends before the microphone opens", async () => {
    let handOverMicrophone = (_stream: unknown) => {};
    getUserMedia.mockReturnValue(
      new Promise((resolve) => {
        handOverMicrophone = resolve;
      }),
    );
    const live = useLiveAnnouncement({ onFinished, onError });
    const starting = live.start("kitchen", true);

    live.stop();
    handOverMicrophone({ getTracks: () => [microphoneTrack] });
    await starting;

    expect(FakeWebSocket.instances).toHaveLength(0);
    // the microphone that arrived late is handed straight back
    expect(microphoneTrack.stop).toHaveBeenCalled();
    expect(FakeAudioContext.last!.close).toHaveBeenCalled();
    expect(live.state.value).toBe("idle");
  });

  it("surfaces the reason a session was rejected", async () => {
    const live = useLiveAnnouncement({ onFinished, onError });
    await live.start("kitchen", true);

    socket().reject(4001, "Player is not available");

    expect(onError).toHaveBeenCalledWith("Player is not available");
    expect(microphoneTrack.stop).toHaveBeenCalled();
    expect(FakeAudioContext.last!.close).toHaveBeenCalled();
    expect(live.state.value).toBe("idle");
  });

  it("reports an error the server sent while streaming", async () => {
    const live = await startAccepted();

    socket().receive({ type: "error", message: "Announcement failed" });

    expect(onError).toHaveBeenCalledWith("Announcement failed");
    expect(microphoneTrack.stop).toHaveBeenCalled();
    expect(live.state.value).toBe("idle");
  });

  it("reports a microphone the browser refuses to hand over", async () => {
    getUserMedia.mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    const live = useLiveAnnouncement({ onFinished, onError });

    await live.start("kitchen", true);

    expect(onError).toHaveBeenCalledWith($t("play_announcement_mic_denied"));
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(live.state.value).toBe("idle");
  });

  it("releases everything when the clip is abandoned", async () => {
    const live = await startAccepted();

    live.cancel();

    expect(microphoneTrack.stop).toHaveBeenCalled();
    expect(FakeAudioContext.last!.close).toHaveBeenCalled();
    expect(socket().closed).toBe(true);
    expect(live.state.value).toBe("idle");
    // closing the socket ourselves is not a failure
    expect(onError).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("is only supported with a microphone on a local connection", () => {
    expect(liveAnnouncementSupported()).toBe(true);

    apiMock.isRemoteConnection.value = true;
    expect(liveAnnouncementSupported()).toBe(false);

    apiMock.isRemoteConnection.value = false;
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    });
    expect(liveAnnouncementSupported()).toBe(false);
  });
});
