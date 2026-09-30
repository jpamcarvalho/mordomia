import { describe, expect, it } from "vitest";
import { homePhase } from "./phase";

describe("AC-3: homePhase", () => {
  it("shows the splash while the location has not settled, whatever the map status", () => {
    expect(homePhase(false, "loading")).toBe("splash");
    expect(homePhase(false, "ready")).toBe("splash");
    expect(homePhase(false, "failed")).toBe("splash");
  });

  it("shows the splash while the map is loading", () => {
    expect(homePhase(true, "loading")).toBe("splash");
  });

  it("shows the map when the location settled and the map is ready", () => {
    expect(homePhase(true, "ready")).toBe("map");
  });

  it("shows the error when the location settled and the map failed", () => {
    expect(homePhase(true, "failed")).toBe("error");
  });
});
