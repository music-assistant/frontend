/**
 * Turns errors that escape a test into a failure of that test.
 *
 * Errors raised while a test runs but outside its own call stack - a Vue
 * watcher rejecting on a partial mock, a callback throwing from a timer - reach
 * Vitest as unhandled errors. Vitest reports those in a separate "Errors"
 * section that is absent from the pass/fail tally, so a run can print
 * "Tests 1349 passed" while actually failing. Re-throwing them from a hook puts
 * them in the tally and pins them to the test that was running.
 *
 * Errors raised in between tests keep Vitest's own reporting, which names the
 * test file but no individual test.
 */
import { afterAll, afterEach, beforeEach } from "vitest";

// Captured while the globals are still real: a test that installs fake timers
// replaces setImmediate, and the queue this waits on is the real one Node
// drains rejections from.
const queueMacrotask = globalThis.setImmediate;

const escapedErrors: unknown[] = [];

const recordEscapedError = (error: unknown) => {
  escapedErrors.push(error);
};

const listenForEscapedErrors = () => {
  process.on("unhandledRejection", recordEscapedError);
  process.on("uncaughtException", recordEscapedError);
};

const stopListeningForEscapedErrors = () => {
  process.off("unhandledRejection", recordEscapedError);
  process.off("uncaughtException", recordEscapedError);
};

const reportEscapedErrors = async () => {
  // Node reports unhandled rejections once the microtask queue has drained, so
  // yield a macrotask before handing back to catch the test that just finished.
  await new Promise((resolve) => queueMacrotask(resolve));
  stopListeningForEscapedErrors();

  if (escapedErrors.length === 0) return;

  const errors = escapedErrors.splice(0);
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, `${errors.length} errors escaped this test`);
};

// Vitest ignores an unhandled error as soon as a second listener is registered,
// assuming user code took charge of it. Listening only while a test runs keeps
// that hand-off scoped, so anything raised in between still gets reported
// rather than landing in a buffer that nothing drains.
beforeEach(() => {
  // A throwing teardown hook skips the rest of the file's teardown, leaving the
  // previous test's listeners in place, so drop them before re-arming.
  stopListeningForEscapedErrors();
  listenForEscapedErrors();
});

afterEach(reportEscapedErrors);

// Backstop for the same skipped-teardown case: without it, errors captured
// after the last hook ran would be swallowed instead of failing the file.
afterAll(reportEscapedErrors);
