import { afterEach, describe, expect, it, vi } from "vitest";

describe("network guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks fetch and names the URL", () => {
    expect(() => fetch("https://ma.example/imageproxy/album.jpg")).toThrow(
      'fetch("https://ma.example/imageproxy/album.jpg")',
    );
  });

  it("names the URL of a URL object", () => {
    expect(() => fetch(new URL("https://ma.example/info"))).toThrow(
      'fetch("https://ma.example/info")',
    );
  });

  it("names the URL of a Request object", () => {
    expect(() =>
      fetch(new Request("https://ma.example/preview?path=track")),
    ).toThrow('fetch("https://ma.example/preview?path=track")');
  });

  it("blocks a WebSocket and names the URL", () => {
    expect(() => new WebSocket("wss://ma.example/ws")).toThrow(
      'new WebSocket("wss://ma.example/ws")',
    );
  });

  it("keeps the WebSocket readyState constants", () => {
    expect(WebSocket.CONNECTING).toBe(0);
    expect(WebSocket.OPEN).toBe(1);
    expect(WebSocket.CLOSING).toBe(2);
    expect(WebSocket.CLOSED).toBe(3);
  });

  it("lets a test stub the globals and restores the guard afterwards", () => {
    const stub = vi.fn();
    vi.stubGlobal("fetch", stub);
    fetch("https://ma.example/info");
    expect(stub).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
    expect(() => fetch("https://ma.example/info")).toThrow(
      "Blocked a real network request",
    );
  });
});
