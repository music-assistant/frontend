/**
 * Turns errors that escape a test into a failure of that test.
 *
 * Errors thrown outside the test's own call stack - a Vue watcher rejecting on
 * a partial mock, a callback throwing from a timer - reach Vitest as unhandled
 * errors. Vitest reports those in a separate "Errors" section that is absent
 * from the pass/fail tally, so a run can print "Tests 1349 passed" while
 * actually failing. Re-throwing them from a hook puts them in the tally and
 * pins them to the test that was running.
 */
import { afterEach, beforeEach } from "vitest";

// Captured while the globals are still real: a test that installs fake timers
// replaces setImmediate, and the queue this hook waits on is the real one Node
// drains rejections from.
const queueMacrotask = globalThis.setImmediate;

const escapedErrors: unknown[] = [];

const recordEscapedError = (error: unknown) => {
  escapedErrors.push(error);
};

// Vitest ignores an unhandled error as soon as a second listener is registered,
// assuming user code took charge of it. Listening only while a test runs keeps
// that hand-off scoped: anything raised in between still gets Vitest's own
// reporting instead of landing in a buffer that nothing drains.
beforeEach(() => {
  process.on("unhandledRejection", recordEscapedError);
  process.on("uncaughtException", recordEscapedError);
});

afterEach(async () => {
  // Node reports unhandled rejections once the microtask queue has drained, so
  // yield a macrotask before handing back to catch the test that just finished.
  await new Promise((resolve) => queueMacrotask(resolve));

  process.off("unhandledRejection", recordEscapedError);
  process.off("uncaughtException", recordEscapedError);

  if (escapedErrors.length === 0) return;

  const errors = escapedErrors.splice(0);
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, `${errors.length} errors escaped this test`);
});
