import { describe, expect, it } from "vitest";
import { user } from "../../tests/fixtures/user";
import { accountFormValues, accountUpdates } from "./account_form";

const sam = user({
  username: "sam",
  display_name: "Sam",
  avatar_url: "https://example.com/sam.png",
});

describe("accountFormValues", () => {
  it("takes the fields of the account", () => {
    expect(accountFormValues(sam)).toEqual({
      username: "sam",
      displayName: "Sam",
      avatarUrl: "https://example.com/sam.png",
    });
  });

  it("leaves a field the account has not set empty", () => {
    expect(
      accountFormValues(user({ username: "sam", display_name: null })),
    ).toEqual({ username: "sam", displayName: "", avatarUrl: "" });
  });

  it("is empty without an account", () => {
    expect(accountFormValues(undefined)).toEqual({
      username: "",
      displayName: "",
      avatarUrl: "",
    });
  });
});

describe("accountUpdates", () => {
  it("is empty when the form changes nothing", () => {
    expect(accountUpdates(accountFormValues(sam), sam)).toEqual({});
  });

  it("holds only the fields that changed", () => {
    expect(
      accountUpdates(
        { ...accountFormValues(sam), displayName: "Samantha" },
        sam,
      ),
    ).toEqual({ displayName: "Samantha" });
  });

  it("clears a field that is emptied", () => {
    expect(
      accountUpdates({ ...accountFormValues(sam), avatarUrl: "" }, sam),
    ).toEqual({ avatarUrl: "" });
  });

  it("takes an empty field as no change on an account that has it unset", () => {
    const unset = user({ username: "sam", display_name: null });

    expect(accountUpdates(accountFormValues(unset), unset)).toEqual({});
  });
});
