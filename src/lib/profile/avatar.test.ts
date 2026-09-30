import { describe, expect, it } from "vitest";
import { avatarInitial } from "./avatar";

describe("AC-10: avatarInitial", () => {
  it("returns the first character upper-cased", () => {
    expect(avatarInitial("joao")).toBe("J");
    expect(avatarInitial("_bob")).toBe("_");
    expect(avatarInitial("7up")).toBe("7");
  });

  it('returns "?" for null or empty', () => {
    expect(avatarInitial(null)).toBe("?");
    expect(avatarInitial("")).toBe("?");
  });
});
