import { describe, expect, it } from "vitest";
import { NOTES_MAX, parseDetails } from "./details";

describe("parseDetails", () => {
  it("accepts whole ratings 0–10 and no rating", () => {
    expect(parseDetails({ rating: 0 })).toEqual({ rating: 0, notes: null });
    expect(parseDetails({ rating: 10, notes: "great" })).toEqual({ rating: 10, notes: "great" });
    expect(parseDetails({})).toEqual({ rating: null, notes: null });
    expect(parseDetails(null)).toEqual({ rating: null, notes: null });
  });

  it("rejects out-of-range, fractional or non-number ratings", () => {
    expect(parseDetails({ rating: -1 })).toBeNull();
    expect(parseDetails({ rating: 11 })).toBeNull();
    expect(parseDetails({ rating: 7.5 })).toBeNull();
    expect(parseDetails({ rating: "8" })).toBeNull();
  });

  it("trims notes, turns blank into null, and caps the length", () => {
    expect(parseDetails({ notes: "  bacalhau!  " })?.notes).toBe("bacalhau!");
    expect(parseDetails({ notes: "   " })?.notes).toBeNull();
    expect(parseDetails({ notes: "x".repeat(NOTES_MAX + 1) })).toBeNull();
    expect(parseDetails({ notes: 3 })).toBeNull();
  });
});
