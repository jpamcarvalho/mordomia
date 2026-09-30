import { describe, expect, it, vi } from "vitest";
import { PORTO } from "./config";
import {
  requestLocation,
  resolveInitialView,
  resolveRecenter,
  type LocationResult,
  type LocationState,
} from "./location";

type Success = (position: GeolocationPosition) => void;
type Failure = (error: GeolocationPositionError) => void;

function fakeGeolocation(respond: (success: Success, failure: Failure) => void) {
  const getCurrentPosition = vi.fn<
    (success: Success, failure?: Failure | null, options?: PositionOptions) => void
  >((success, failure) => respond(success, failure!));
  const watchPosition = vi.fn();
  const geo = { getCurrentPosition, watchPosition, clearWatch: vi.fn() } as unknown as Geolocation;
  return { geo, getCurrentPosition, watchPosition };
}

function position(lat: number, lng: number) {
  return { coords: { latitude: lat, longitude: lng } } as GeolocationPosition;
}

function positionError(code: number) {
  return { code, message: "" } as GeolocationPositionError;
}

const HERE = { lat: 38.7223, lng: -9.1393 };
const THERE = { lat: 40.4168, lng: -3.7038 };
const FAILURES = ["denied", "unavailable", "timeout", "unsupported"] as const;

describe("AC-4: requestLocation", () => {
  it("calls getCurrentPosition once with the options and never watchPosition", async () => {
    const { geo, getCurrentPosition, watchPosition } = fakeGeolocation((success) =>
      success(position(HERE.lat, HERE.lng)),
    );

    await expect(requestLocation(geo)).resolves.toEqual({ ok: true, position: HERE });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({
      timeout: 10000,
      maximumAge: 0,
      enableHighAccuracy: false,
    });
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ])("maps error code %i to %s", async (code, reason) => {
    const { geo } = fakeGeolocation((_, failure) => failure(positionError(code)));
    await expect(requestLocation(geo)).resolves.toEqual({ ok: false, reason });
  });

  it("returns unsupported when there is no geolocation API", async () => {
    await expect(requestLocation(undefined)).resolves.toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("AC-5, AC-6: resolveInitialView", () => {
  it("AC-5: centers on the position at zoom 15 with the dot and no notice", () => {
    expect(resolveInitialView({ ok: true, position: HERE })).toEqual({
      center: HERE,
      zoom: 15,
      userPosition: HERE,
      showNotice: false,
    });
  });

  it.each(FAILURES)("AC-6: %s → Porto, zoom 13, no dot, notice", (reason) => {
    expect(resolveInitialView({ ok: false, reason })).toEqual({
      center: PORTO,
      zoom: 13,
      userPosition: null,
      showNotice: true,
    });
  });
});

describe("AC-7: resolveRecenter", () => {
  const located: LocationState = { center: HERE, zoom: 15, userPosition: HERE, showNotice: false };
  const fallback: LocationState = { center: PORTO, zoom: 13, userPosition: null, showNotice: true };
  const success: LocationResult = { ok: true, position: THERE };

  it("success → new fix at zoom 15, dot there, no notice", () => {
    for (const prev of [located, fallback]) {
      expect(resolveRecenter(prev, success)).toEqual({
        state: { center: THERE, zoom: 15, userPosition: THERE, showNotice: false },
        camera: { center: THERE, zoom: 15 },
      });
    }
  });

  it.each(FAILURES)("%s after an earlier fix → camera and dot at the last fix, zoom 15, notice", (reason) => {
    const panned: LocationState = { ...located, center: THERE, zoom: 11 };
    expect(resolveRecenter(panned, { ok: false, reason })).toEqual({
      state: { center: HERE, zoom: 15, userPosition: HERE, showNotice: true },
      camera: { center: HERE, zoom: 15 },
    });
  });

  it.each(FAILURES)("%s with no fix ever → Porto, zoom 13, no dot, notice", (reason) => {
    expect(resolveRecenter({ ...fallback, showNotice: false }, { ok: false, reason })).toEqual({
      state: { center: PORTO, zoom: 13, userPosition: null, showNotice: true },
      camera: { center: PORTO, zoom: 13 },
    });
  });
});
