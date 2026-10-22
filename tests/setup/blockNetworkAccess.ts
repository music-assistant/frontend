/**
 * Fails a test that reaches the network instead of stubbing it.
 *
 * happy-dom resolves real hostnames, so an unstubbed request surfaces as a DNS
 * error or a timeout raised wherever the response happened to be awaited -
 * often nowhere near the call that was left unstubbed. Replacing the globals
 * with a throw names the offending URL instead, and does it before any packet
 * leaves the machine.
 *
 * Tests that need a response stub these globals as usual; `vi.stubGlobal` puts
 * the guard back when the test unstubs. Code under test that catches its own
 * network errors swallows this throw too, so the guard fails a test only where
 * the error is left to propagate.
 */

const requestUrl = (input: RequestInfo | URL) =>
  typeof input === "string" || input instanceof URL ? String(input) : input.url;

const blockRequest = (call: string): never => {
  throw new Error(
    `Blocked a real network request from a test: ${call}. Stub it instead of reaching the network.`,
  );
};

globalThis.fetch = (input: RequestInfo | URL) =>
  blockRequest(`fetch("${requestUrl(input)}")`);

globalThis.WebSocket = Object.assign(
  function (url: string | URL) {
    blockRequest(`new WebSocket("${url}")`);
  },
  // App code compares readyState against these constants on the global
  // constructor, so they have to survive the swap. The values are fixed by the
  // WebSocket spec, which keeps this independent of the test environment.
  { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 },
) as unknown as typeof WebSocket;
