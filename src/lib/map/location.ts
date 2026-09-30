import { GEOLOCATION_OPTIONS, PORTO, ZOOM_FALLBACK, ZOOM_LOCATED } from "./config";

export type LatLng = { lat: number; lng: number };

export type LocationResult =
  | { ok: true; position: LatLng }
  | { ok: false; reason: "denied" | "unavailable" | "timeout" | "unsupported" };

export type LocationState = {
  center: LatLng;
  zoom: number;
  userPosition: LatLng | null;
  showNotice: boolean;
};

export type Camera = { center: LatLng; zoom: number };

const ERROR_REASONS: Record<number, "denied" | "unavailable" | "timeout"> = {
  1: "denied",
  2: "unavailable",
  3: "timeout",
};

export type RequestLocationOptions = {
  // Called when the reading succeeds after the cap already resolved as a timeout (AC-18).
  onLateSuccess?: (position: LatLng) => void;
};

// One getCurrentPosition reading (AC-4). Never watches the position.
// Resolves a "timeout" failure at most GEOLOCATION_OPTIONS.timeout ms after the request, even while the browser's
// permission prompt is unanswered (its own timeout only starts once permission is granted; Decision #29).
// A success after that cap goes to onLateSuccess; a failure after it is ignored.
export function requestLocation(
  geo: Geolocation | undefined,
  { onLateSuccess }: RequestLocationOptions = {},
): Promise<LocationResult> {
  if (!geo) return Promise.resolve({ ok: false, reason: "unsupported" });
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(cap);
      resolve(result);
    };
    const cap = setTimeout(() => settle({ ok: false, reason: "timeout" }), GEOLOCATION_OPTIONS.timeout);

    geo.getCurrentPosition(
      (position) => {
        const latLng = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (settled) onLateSuccess?.(latLng);
        else settle({ ok: true, position: latLng });
      },
      (error) => settle({ ok: false, reason: ERROR_REASONS[error.code] ?? "unavailable" }),
      GEOLOCATION_OPTIONS,
    );
  });
}

const FALLBACK_VIEW: LocationState = {
  center: PORTO,
  zoom: ZOOM_FALLBACK,
  userPosition: null,
  showNotice: true,
};

function locatedView(position: LatLng): LocationState {
  return { center: position, zoom: ZOOM_LOCATED, userPosition: position, showNotice: false };
}

// AC-5 / AC-6: first reading → located view, or Porto with the notice.
export function resolveInitialView(result: LocationResult): LocationState {
  return result.ok ? locatedView(result.position) : { ...FALLBACK_VIEW };
}

// AC-7 / Decision #25: a recenter always moves the camera.
export function resolveRecenter(
  prev: LocationState,
  result: LocationResult,
): { state: LocationState; camera: Camera } {
  if (result.ok) {
    return {
      state: locatedView(result.position),
      camera: { center: result.position, zoom: ZOOM_LOCATED },
    };
  }
  if (prev.userPosition) {
    const last = prev.userPosition;
    return {
      state: { center: last, zoom: ZOOM_LOCATED, userPosition: last, showNotice: true },
      camera: { center: last, zoom: ZOOM_LOCATED },
    };
  }
  return { state: { ...FALLBACK_VIEW }, camera: { center: PORTO, zoom: ZOOM_FALLBACK } };
}
