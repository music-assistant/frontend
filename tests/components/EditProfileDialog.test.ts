// Imported once, outside any test: the form and the dialog behind this screen
// are the expensive part, and the import phase is not on a test's clock.
import EditProfileDialog from "@/components/profile/EditProfileDialog.vue";
import { ApiCommandError } from "@/plugins/api/errors";
import { type User } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { apiMock, runAfterPreferenceWritesMock, storeMock, toastMock } =
  vi.hoisted(() => ({
    apiMock: { updateUser: vi.fn() },
    runAfterPreferenceWritesMock: vi.fn(),
    storeMock: {
      currentUser: undefined as User | undefined,
      isTouchscreen: false,
    },
    toastMock: { error: vi.fn(), success: vi.fn() },
  }));

vi.mock("@/plugins/api", async () => ({
  api: apiMock,
  default: apiMock,
  // the component tells an error the server explained from any other
  ApiCommandError: (
    await vi.importActual<typeof import("@/plugins/api/errors")>(
      "@/plugins/api/errors",
    )
  ).ApiCommandError,
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

vi.mock("@/composables/userPreferences", () => ({
  runAfterPreferenceWrites: runAfterPreferenceWritesMock,
}));

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = () => resolvePromise();
  });
  return { promise, resolve };
}

async function mountDialog(open = true) {
  const wrapper = mount(EditProfileDialog, {
    props: { open },
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

// the dialog renders into the body, outside the wrapper
function input(id: string) {
  const element = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!element) throw new Error(`No field ${id}`);
  return element;
}

async function type(id: string, value: string) {
  const element = input(id);
  element.value = value;
  element.dispatchEvent(new Event("input"));
  await flushPromises();
}

function saveButton() {
  const button = document.querySelector<HTMLButtonElement>(
    'button[form="form-edit-profile"]',
  );
  if (!button) throw new Error("No save button");
  return button;
}

async function submit() {
  document
    .querySelector("#form-edit-profile")
    ?.dispatchEvent(new Event("submit"));
  await flushPromises();
}

describe("EditProfileDialog", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    storeMock.currentUser = user({
      user_id: "sam-1",
      username: "sam",
      display_name: "Sam",
    });
    apiMock.updateUser.mockReset();
    // the real one gives whatever it is handed its turn among the preference
    // writes; here there are none to wait for
    runAfterPreferenceWritesMock.mockImplementation(
      async (task: () => Promise<unknown>) => await task(),
    );
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });

  it("opens on the account as it is, with nothing to save yet", async () => {
    await mountDialog();

    expect(input("username").value).toBe("sam");
    expect(input("displayName").value).toBe("Sam");
    expect(input("avatarUrl").value).toBe("");
    expect(saveButton().disabled).toBe(true);

    await type("displayName", "Samantha");

    expect(saveButton().disabled).toBe(false);
  });

  it("starts over from the account each time it opens", async () => {
    const wrapper = await mountDialog();
    await type("username", "sam-renamed");

    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    await flushPromises();

    expect(input("username").value).toBe("sam");
  });

  it("saves only what changed, and closes once it is saved", async () => {
    apiMock.updateUser.mockResolvedValue(
      user({ user_id: "sam-1", username: "sam", display_name: "Samantha" }),
    );
    const wrapper = await mountDialog();

    await type("displayName", "Samantha");
    await submit();

    expect(apiMock.updateUser).toHaveBeenCalledWith(
      "sam-1",
      { displayName: "Samantha" },
      { suppressGlobalError: true },
    );
    expect(toastMock.success).toHaveBeenCalledWith("auth.profile_updated");
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("clears the display name and avatar url that are emptied", async () => {
    storeMock.currentUser = user({
      user_id: "sam-1",
      username: "sam",
      display_name: "Sam",
      avatar_url: "https://example.com/sam.png",
    });
    const cleared = user({ user_id: "sam-1", username: "sam" });
    // the real api, so what reaches the server is what the dialog sends
    const { MusicAssistantApi } =
      await vi.importActual<typeof import("@/plugins/api")>("@/plugins/api");
    const realApi = new MusicAssistantApi();
    const sendCommand = vi
      .spyOn(realApi, "sendCommand")
      .mockResolvedValue(cleared);
    apiMock.updateUser.mockImplementation(realApi.updateUser.bind(realApi));

    await mountDialog();
    await type("displayName", "");
    await type("avatarUrl", "");
    await submit();

    expect(sendCommand).toHaveBeenCalledWith(
      "auth/user/update",
      { user_id: "sam-1", display_name: "", avatar_url: "" },
      { suppressGlobalError: true },
    );
    expect(storeMock.currentUser).toBe(cleared);
    expect(toastMock.success).toHaveBeenCalledWith("auth.profile_updated");
  });

  it("stays open with the server's reason when it refuses the change", async () => {
    apiMock.updateUser.mockRejectedValue(
      new ApiCommandError("refused", 1, "Username already exists"),
    );
    const wrapper = await mountDialog();

    await type("username", "alex");
    await submit();

    expect(toastMock.error).toHaveBeenCalledWith("Username already exists");
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(wrapper.emitted("update:open")).toBeUndefined();
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

    await mountDialog();
    await type("username", "sam-renamed");
    await submit();

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

    await mountDialog();
    await type("username", "sam-renamed");
    await submit();

    // somebody else is signed in before the save comes back
    const alex = user({ user_id: "alex-1", username: "alex" });
    storeMock.currentUser = alex;
    landSave();
    await flushPromises();

    // the reply is about an account nobody is looking at any more
    expect(storeMock.currentUser).toBe(alex);
  });
});
