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
  const requested = useRef(false);

  // AC-4: a single reading on mount; the ref keeps StrictMode's double effect from asking twice.
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    requestLocation(navigator.geolocation).then((result) => {
      const view = resolveInitialView(result);
      setInitialView(view);
      setLocation(view);
    });
  }, []);

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

  // AC-7 / Decision #25: fresh reading; returns the camera MapView applies.
  async function recenter(): Promise<Camera> {
    setRecentering(true);
    const result = await requestLocation(navigator.geolocation);
    const { state, camera } = resolveRecenter(location!, result);
    setLocation(state);
    if (!result.ok) setNoticeDismissed(false);
    setRecentering(false);
    return camera;
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
