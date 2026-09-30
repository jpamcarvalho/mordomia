import { StrictMode, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PORTO, type MapsConfig } from "@/lib/map/config";
import { HomeMap } from "./home-map";

const mocks = vi.hoisted(() => ({
  mapProps: null as Record<string, unknown> | null,
  apiProviderRenders: 0,
  apiProviderOnError: null as ((error: unknown) => void) | null,
  map: { panTo: vi.fn(), setZoom: vi.fn() },
}));

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children, onError }: { children: ReactNode; onError: (e: unknown) => void }) => {
    mocks.apiProviderRenders += 1;
    mocks.apiProviderOnError = onError;
    return <div data-testid="api-provider">{children}</div>;
  },
  Map: (props: Record<string, unknown> & { children?: ReactNode }) => {
    mocks.mapProps = props;
    return <div data-testid="map">{props.children}</div>;
  },
  AdvancedMarker: ({
    position,
    children,
  }: {
    position: { lat: number; lng: number };
    children: ReactNode;
  }) => (
    <div data-testid="marker" data-lat={position.lat} data-lng={position.lng}>
      {children}
    </div>
  ),
  useMap: () => mocks.map,
  ColorScheme: { DARK: "DARK", LIGHT: "LIGHT", FOLLOW_SYSTEM: "FOLLOW_SYSTEM" },
}));

vi.mock("@/app/login/actions", () => ({ logout: vi.fn() }));

// Fake Geolocation: each getCurrentPosition call is kept pending until the test settles it.
type PendingCall = {
  options: PositionOptions | undefined;
  succeed: (lat: number, lng: number) => Promise<void>;
  fail: (code: number) => Promise<void>;
};

let calls: PendingCall[];
let watchPosition: ReturnType<typeof vi.fn>;

function installGeolocation() {
  calls = [];
  watchPosition = vi.fn();
  const geo = {
    getCurrentPosition: (
      success: PositionCallback,
      failure?: PositionErrorCallback | null,
      options?: PositionOptions,
    ) => {
      calls.push({
        options,
        succeed: (lat, lng) =>
          act(async () => {
            success({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition);
          }),
        fail: (code) =>
          act(async () => {
            failure?.({ code, message: "" } as GeolocationPositionError);
          }),
      });
    },
    watchPosition,
    clearWatch: vi.fn(),
  };
  Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true });
}

const CONFIG: MapsConfig = { apiKey: "test-key", mapId: "test-map-id" };
const HERE = { lat: 38.7223, lng: -9.1393 };
const THERE = { lat: 40.4168, lng: -3.7038 };
const NOTICE = "Location is off — showing Porto. Enable location to see what's near you.";

async function tilesLoaded() {
  await act(async () => {
    (mocks.mapProps!.onTilesLoaded as () => void)();
  });
}

async function renderLocated() {
  render(<HomeMap username="joao" config={CONFIG} />);
  await calls[0].succeed(HERE.lat, HERE.lng);
  await tilesLoaded();
}

async function renderFallback() {
  render(<HomeMap username="joao" config={CONFIG} />);
  await calls[0].fail(1);
  await tilesLoaded();
}

async function tapRecenter() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Recenter map" }));
  });
}

function dots() {
  return screen.queryAllByTestId("user-dot");
}

function markerPosition() {
  const marker = screen.getByTestId("marker");
  return { lat: Number(marker.dataset.lat), lng: Number(marker.dataset.lng) };
}

beforeEach(() => {
  installGeolocation();
  mocks.mapProps = null;
  mocks.apiProviderRenders = 0;
  mocks.apiProviderOnError = null;
  mocks.map.panTo.mockClear();
  mocks.map.setZoom.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("AC-3: splash", () => {
  it("shows the splash while the reading is pending and until the first tiles load", async () => {
    render(<HomeMap username="joao" config={CONFIG} />);
    expect(screen.getByText("Mordomia")).toBeTruthy();
    expect(screen.getByText("Finding your location…")).toBeTruthy();

    await calls[0].succeed(HERE.lat, HERE.lng);
    // Location settled, tiles not loaded yet: still the splash.
    expect(screen.queryByText("Finding your location…")).not.toBeNull();

    await tilesLoaded();
    expect(screen.queryByText("Finding your location…")).toBeNull();
    expect(screen.queryByText("Mordomia")).toBeNull();
  });

  it("keeps the splash while the location is pending even if the map already failed", async () => {
    render(<HomeMap username="joao" config={null} />);
    expect(screen.queryByText("Finding your location…")).not.toBeNull();
    expect(screen.queryByText("We couldn't load the map.")).toBeNull();

    await calls[0].fail(3);
    expect(screen.queryByText("Finding your location…")).toBeNull();
    expect(screen.getByText("We couldn't load the map.")).toBeTruthy();
  });
});

describe("AC-4: single reading", () => {
  it("asks for the location once, even under StrictMode, and never watches it", async () => {
    render(
      <StrictMode>
        <HomeMap username="joao" config={CONFIG} />
      </StrictMode>,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].options).toEqual({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
    expect(watchPosition).not.toHaveBeenCalled();
  });
});

describe("AC-5: located", () => {
  it("centers the map on the reading at zoom 15 with one blue dot there", async () => {
    await renderLocated();
    expect(mocks.mapProps!.defaultCenter).toEqual(HERE);
    expect(mocks.mapProps!.defaultZoom).toBe(15);
    expect(dots()).toHaveLength(1);
    expect(markerPosition()).toEqual(HERE);
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe("AC-6: fallback", () => {
  it("centers on Porto at zoom 13, shows the notice, and ✕ hides it until the next visit", async () => {
    await renderFallback();
    expect(mocks.mapProps!.defaultCenter).toEqual(PORTO);
    expect(mocks.mapProps!.defaultZoom).toBe(13);
    expect(dots()).toHaveLength(0);
    expect(screen.getByText(NOTICE)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(NOTICE)).toBeNull();

    // A new visit: nothing was stored, so the notice is back.
    cleanup();
    installGeolocation();
    await renderFallback();
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  it.each([
    [2, "unavailable"],
    [3, "timeout"],
  ])("also falls back when the reading fails with code %i (%s)", async (code) => {
    render(<HomeMap username="joao" config={CONFIG} />);
    await calls[0].fail(code);
    await tilesLoaded();
    expect(mocks.mapProps!.defaultCenter).toEqual(PORTO);
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });
});

describe("AC-7: recenter", () => {
  it("success: a new reading moves the camera to it at zoom 15 and moves the dot", async () => {
    await renderLocated();
    await tapRecenter();
    expect(calls).toHaveLength(2);
    await calls[1].succeed(THERE.lat, THERE.lng);

    expect(mocks.map.panTo).toHaveBeenCalledWith(THERE);
    expect(mocks.map.setZoom).toHaveBeenCalledWith(15);
    expect(dots()).toHaveLength(1);
    expect(markerPosition()).toEqual(THERE);
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("disables the button while a reading is in flight", async () => {
    await renderLocated();
    await tapRecenter();
    const button = screen.getByRole("button", { name: "Recenter map" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    await calls[1].succeed(THERE.lat, THERE.lng);
    expect(button.disabled).toBe(false);
  });

  it("failure after a fix: back to the last fix, dot kept, notice shown even if dismissed before", async () => {
    await renderLocated();

    await tapRecenter();
    await calls[1].fail(1);
    expect(mocks.map.panTo).toHaveBeenLastCalledWith(HERE);
    expect(mocks.map.setZoom).toHaveBeenLastCalledWith(15);
    expect(dots()).toHaveLength(1);
    expect(markerPosition()).toEqual(HERE);
    expect(screen.getByText(NOTICE)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(NOTICE)).toBeNull();

    await tapRecenter();
    await calls[2].fail(3);
    expect(mocks.map.panTo).toHaveBeenLastCalledWith(HERE);
    expect(dots()).toHaveLength(1);
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  it("failure with no fix ever: Porto at zoom 13, no dot, notice", async () => {
    await renderFallback();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await tapRecenter();
    await calls[1].fail(2);
    expect(mocks.map.panTo).toHaveBeenCalledWith(PORTO);
    expect(mocks.map.setZoom).toHaveBeenCalledWith(13);
    expect(dots()).toHaveLength(0);
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });
});

describe("AC-8, AC-9: map options", () => {
  it("AC-8: hides the default controls and uses one-finger gestures", async () => {
    await renderLocated();
    expect(mocks.mapProps!.disableDefaultUI).toBe(true);
    expect(mocks.mapProps!.gestureHandling).toBe("greedy");
  });

  it("AC-9: uses the cloud Map ID, the light color scheme, no styles, and non-clickable icons", async () => {
    await renderLocated();
    expect(mocks.mapProps!.mapId).toBe("test-map-id");
    expect(mocks.mapProps!.colorScheme).toBe("LIGHT");
    expect(mocks.mapProps).not.toHaveProperty("styles");
    expect(mocks.mapProps!.clickableIcons).toBe(false);
  });
});

describe("AC-10: avatar menu", () => {
  it("shows the initial and opens a menu with @username and Sign out", async () => {
    await renderLocated();
    const avatar = screen.getByRole("button", { name: "Account menu" });
    expect(avatar.textContent).toBe("J");
    expect(avatar.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(avatar);
    expect(avatar.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu").textContent).toContain("@joao");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(avatar);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(avatar);
    fireEvent.click(avatar);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("has no top bar", async () => {
    await renderLocated();
    expect(screen.queryByRole("banner")).toBeNull();
  });
});

describe("AC-11: map error", () => {
  it("config null: error and Try again, no APIProvider, avatar menu available", async () => {
    render(<HomeMap username="joao" config={null} />);
    await calls[0].succeed(HERE.lat, HERE.lng);

    expect(screen.getByText("We couldn't load the map.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(mocks.apiProviderRenders).toBe(0);
    expect(screen.queryByTestId("api-provider")).toBeNull();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Recenter map" })).toBeNull();
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("APIProvider onError: error state", async () => {
    render(<HomeMap username="joao" config={CONFIG} />);
    await calls[0].fail(1);
    await act(async () => {
      mocks.apiProviderOnError!(new Error("script failed"));
    });
    expect(screen.getByText("We couldn't load the map.")).toBeTruthy();
    expect(screen.queryByText("Finding your location…")).toBeNull();
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
  });

  it("window.gm_authFailure(): error state, and the hook is removed on unmount", async () => {
    const { unmount } = render(<HomeMap username="joao" config={CONFIG} />);
    await calls[0].succeed(HERE.lat, HERE.lng);
    const w = window as Window & { gm_authFailure?: () => void };
    expect(typeof w.gm_authFailure).toBe("function");

    await act(async () => {
      w.gm_authFailure!();
    });
    expect(screen.getByText("We couldn't load the map.")).toBeTruthy();

    unmount();
    expect(w.gm_authFailure).toBeUndefined();
  });
});

describe("AC-12: no restaurant markers", () => {
  it("renders exactly one marker (the user dot) when located", async () => {
    await renderLocated();
    expect(screen.getAllByTestId("marker")).toHaveLength(1);
    expect(screen.getByTestId("marker").contains(screen.getByTestId("user-dot"))).toBe(true);
  });

  it("renders no marker on the Porto fallback", async () => {
    await renderFallback();
    expect(screen.queryAllByTestId("marker")).toHaveLength(0);
  });
});
