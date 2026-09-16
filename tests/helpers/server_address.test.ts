import { probeServerAddress } from "@/helpers/server_address";
import { afterEach, describe, expect, it, vi } from "vitest";

const SERVER_ID = "server-1";
const ADDRESS = "http://192.168.1.10:8095";

/** A fetch that answers every request with this status and body. */
function answering(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

/** Serve the page over this protocol; the probe reads nothing else off it. */
function pageOver(protocol: "http:" | "https:") {
  vi.stubGlobal("location", { protocol });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("probeServerAddress", () => {
  it("asks the address for its server info, without going through a cache", async () => {
    const fetchMock = answering(200, { server_id: SERVER_ID });
    vi.stubGlobal("fetch", fetchMock);

    await expect(probeServerAddress(ADDRESS, SERVER_ID)).resolves.toBe(
      "reachable",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${ADDRESS}/info`);
    expect(init.cache).toBe("no-store");
    // an address that never answers is given up on rather than waited for
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not take another server answering for this one", async () => {
    vi.stubGlobal("fetch", answering(200, { server_id: "someone-else" }));

    await expect(probeServerAddress(ADDRESS, SERVER_ID)).resolves.toBe(
      "unreachable",
    );
  });

  it("reports an address that answers with an error as unreachable", async () => {
    vi.stubGlobal("fetch", answering(502, {}));

    await expect(probeServerAddress(ADDRESS, SERVER_ID)).resolves.toBe(
      "unreachable",
    );
  });

  it("reports an address that does not answer as unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(probeServerAddress(ADDRESS, SERVER_ID)).resolves.toBe(
      "unreachable",
    );
  });

  it("cannot check a plain http address from a page served over https", async () => {
    const fetchMock = answering(200, { server_id: SERVER_ID });
    vi.stubGlobal("fetch", fetchMock);
    pageOver("https:");

    // the browser would refuse the request as mixed content, which says
    // nothing about the address, so it is not even tried
    await expect(probeServerAddress(ADDRESS, SERVER_ID)).resolves.toBe(
      "unchecked",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still checks an https address from a page served over https", async () => {
    vi.stubGlobal("fetch", answering(200, { server_id: SERVER_ID }));
    pageOver("https:");

    await expect(
      probeServerAddress("https://music.example.com", SERVER_ID),
    ).resolves.toBe("reachable");
  });
});
