import { showActionResult } from "@/helpers/action_result";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn() } }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

describe("showActionResult", () => {
  let click: ReturnType<typeof vi.spyOn>;
  const opened = () =>
    click.mock.contexts.map((anchor: unknown) =>
      (anchor as HTMLAnchorElement).getAttribute("href"),
    );

  beforeEach(() => {
    toastMock.success.mockClear();
    click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says the message and opens the url of a result", () => {
    showActionResult({
      message: "Linked",
      open_url: "https://example.org/done",
    });

    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith("Linked");
    expect(opened()).toEqual(["https://example.org/done"]);
  });

  it("says the action is done for a result without a message", () => {
    showActionResult({ message: null, open_url: "https://example.org/a" });

    expect(toastMock.success).toHaveBeenCalledWith("settings.action_completed");
    expect(opened()).toEqual(["https://example.org/a"]);
  });

  it("opens only a web address", () => {
    showActionResult({ message: "Hi", open_url: "javascript:alert(1)" });

    expect(opened()).toEqual([]);
    expect(toastMock.success).toHaveBeenCalledWith("Hi");
  });

  it("says the action is done when the action answers nothing", () => {
    showActionResult(null);

    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
      "settings.action_completed",
    );
    expect(opened()).toEqual([]);
  });
});
