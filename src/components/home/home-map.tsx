"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useRef, useState } from "react";
import { Splash } from "@/components/splash";
import type { MapsConfig } from "@/lib/map/config";
import {
  requestLocation,
  resolveInitialView,
  resolveRecenter,
  type Camera,
  type LocationResult,
  type LocationState,
} from "@/lib/map/location";
import { homePhase, type MapStatus } from "@/lib/map/phase";
import { AvatarMenu } from "./avatar-menu";
import { LocationNotice } from "./location-notice";
import { MapError } from "./map-error";
import { MapView } from "./map-view";

type Props = { username: string | null; config: MapsConfig | null };

type WindowWithAuthFailure = Window & { gm_authFailure?: () => void };

// Home screen orchestrator (design.md → HomeMap state machine; AC-3…AC-12).
export function HomeMap({ username, config }: Props) {
  const [initialView, setInitialView] = useState<LocationState | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>(config ? "loading" : "failed");
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [recentering, setRecentering] = useState(false);
  const [camera, setCamera] = useState<Camera | null>(null);
  const requested = useRef(false);
  // Latest location for async callbacks (late reading, recenter) that outlive the render they started in.
  const locationRef = useRef<LocationState | null>(null);

  const updateLocation = useCallback((state: LocationState) => {
    locationRef.current = state;
    setLocation(state);
  }, []);

  // AC-7 / AC-18 / Decision #25: apply a reading to the current state and move the camera.
  const applyReading = useCallback(
    (result: LocationResult) => {
      const { state, camera: next } = resolveRecenter(locationRef.current!, result);
      updateLocation(state);
      setCamera(next);
    },
    [updateLocation],
  );

  // AC-4: a single reading on mount; the ref keeps StrictMode's double effect from asking twice.
  // Capped at 10 s from the request (Decision #29); a late success moves map + dot there (AC-18).
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    requestLocation(navigator.geolocation, {
      onLateSuccess: (position) => applyReading({ ok: true, position }),
    }).then((result) => {
      const view = resolveInitialView(result);
      setInitialView(view);
      updateLocation(view);
    });
  }, [applyReading, updateLocation]);

  const fail = useCallback(() => setMapStatus("failed"), []);

  // AC-11: Google calls window.gm_authFailure() for invalid or unauthorized keys.
  useEffect(() => {
    if (!config) return;
    const w = window as WindowWithAuthFailure;
    w.gm_authFailure = fail;
    return () => {
      delete w.gm_authFailure;
    };
  }, [config, fail]);

  const onTilesLoaded = useCallback(
    () => setMapStatus((status) => (status === "loading" ? "ready" : status)),
    [],
  );

  // AC-7 / Decision #25: fresh reading (same 10 s cap), then move the camera.
  async function recenter() {
    setRecentering(true);
    const result = await requestLocation(navigator.geolocation);
    applyReading(result);
    if (!result.ok) setNoticeDismissed(false);
    setRecentering(false);
  }

  const phase = homePhase(location !== null, mapStatus);

  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      {config && (
        <APIProvider apiKey={config.apiKey} libraries={["marker"]} onError={fail}>
          {initialView && location && (
            <MapView
              mapId={config.mapId}
              initialView={initialView}
              userPosition={location.userPosition}
              camera={camera}
              showRecenter={phase === "map"}
              recentering={recentering}
              onRecenter={recenter}
              onTilesLoaded={onTilesLoaded}
            />
          )}
        </APIProvider>
      )}
      {phase === "map" && location?.showNotice && !noticeDismissed && (
        <LocationNotice onDismiss={() => setNoticeDismissed(true)} />
      )}
      {phase === "error" && <MapError />}
      {phase !== "splash" && <AvatarMenu username={username} />}
      {phase === "splash" && <Splash />}
    </main>
  );
}
