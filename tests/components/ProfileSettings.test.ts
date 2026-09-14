// Imported once, outside any test: the form, the card and the dialog behind
// this screen are the expensive part, and the import phase is not on a test's
// clock.
import ProfileSettings from "@/components/profile/ProfileSettings.vue";
import { type User } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { apiMock, runAfterPreferenceWritesMock, storeMock, toastMock } =
  vi.hoisted(() => ({
    apiMock: { updateUser: vi.fn() },
    runAfterPreferenceWritesMock: vi.fn(),
    storeMock: {
      currentUser: undefined as User | undefined,
      isIngressSession: false,
      roles: [],
    },
    toastMock: { error: vi.fn(), success: vi.fn() },
  }));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
  // the component tells an error the server explained from any other
  ApiCommandError: class ApiCommandError extends Error {
    details?: string;
  },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

vi.mock("@/composables/userPreferences", () => ({
  runAfterPreferenceWrites: runAfterPreferenceWritesMock,
}));

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = () => resolvePromise();
  });
  return { promise, resolve };
}

function mountSettings() {
  return mount(ProfileSettings, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("ProfileSettings", () => {
  beforeEach(() => {
    storeMock.currentUser = user({
      user_id: "sam-1",
      username: "sam",
      display_name: "Sam",
    });
    storeMock.isIngressSession = false;
    apiMock.updateUser.mockReset();
    // the real one gives whatever it is handed its turn among the preference
    // writes; here there are none to wait for
    runAfterPreferenceWritesMock.mockImplementation(
      async (task: () => Promise<unknown>) => await task(),
    );
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });

  it("saves the profile in its turn among the preference writes", async () => {
    const renamed = user({
      user_id: "sam-1",
      username: "sam-renamed",
      display_name: "Sam",
    });
    apiMock.updateUser.mockResolvedValue(renamed);
    const turn = createDeferred();
    runAfterPreferenceWritesMock.mockImplementationOnce(
      async (task: () => Promise<unknown>) => {
        await turn.promise;
        return await task();
      },
    );

    const wrapper = mountSettings();
    await wrapper.find("#username").setValue("sam-renamed");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    // the account the server sends back carries the preferences with it, so a
    // save that overtook a write on its way out would hand the store an older
    // set than the one just written
    expect(apiMock.updateUser).not.toHaveBeenCalled();
    expect(storeMock.currentUser?.username).toBe("sam");

    turn.resolve();
    await flushPromises();

    // request and replacement both happen in that turn, so no write can start
    // between them and be taken back off by an older reply
    expect(apiMock.updateUser).toHaveBeenCalledOnce();
    expect(storeMock.currentUser).toBe(renamed);
    expect(toastMock.success).toHaveBeenCalledOnce();

    wrapper.unmount();
  });

  it("leaves an account that was signed in since the save alone", async () => {
    const renamed = user({
      user_id: "sam-1",
      username: "sam-renamed",
      display_name: "Sam",
    });
    let landSave: () => void = () => {};
    apiMock.updateUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          landSave = () => resolve(renamed);
        }),
    );

    const wrapper = mountSettings();
    await wrapper.find("#username").setValue("sam-renamed");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    // somebody else is signed in before the save comes back
    const alex = user({ user_id: "alex-1", username: "alex" });
    storeMock.currentUser = alex;
    landSave();
    await flushPromises();

    // the reply is about an account nobody is looking at any more
    expect(storeMock.currentUser).toBe(alex);

    wrapper.unmount();
  });
});
