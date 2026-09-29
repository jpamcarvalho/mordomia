import { describe, expect, it } from "vitest";
import { isValidUsername, normalizeUsername } from "./username";

const validate = (raw: string) => isValidUsername(normalizeUsername(raw));

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Joao_1 ")).toBe("joao_1");
  });
});

describe("isValidUsername (after normalizing)", () => {
  it.each(["abc", "joao", "a_b_c", "user_123", "a".repeat(24), "JOAO", "  Maria_9  "])(
    "accepts %j",
    (raw) => {
      expect(validate(raw)).toBe(true);
    },
  );

  it.each([
    "",
    "ab",
    "  ab  ",
    "a".repeat(25),
    "joão",
    "john.doe",
    "john-doe",
    "john doe",
    "user@x",
    "emoji😀",
  ])("rejects %j", (raw) => {
    expect(validate(raw)).toBe(false);
  });
});
