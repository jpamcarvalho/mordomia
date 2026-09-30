"use client";

import { useEffect } from "react";
import { ColorScheme, Map, useMap } from "@vis.gl/react-google-maps";
import type { Camera, LocationState } from "@/lib/map/location";
import { RecenterButton } from "./recenter-button";
import { UserDot } from "./user-dot";

type Props = {
  mapId: string;
  // Initial view only (used as defaultCenter / defaultZoom); later moves go through `camera`.
  initialView: LocationState;
  userPosition: LocationState["userPosition"];
  // Latest camera move requested by HomeMap (recenter, late location); a new object means a new move.
  camera: Camera | null;
  showRecenter: boolean;
  recentering: boolean;
  onRecenter: () => void;
  onTilesLoaded: () => void;
};

// The Google map, the user dot and the camera moves (needs useMap(), so it lives inside APIProvider).
export function MapView({
  mapId,
  initialView,
  userPosition,
  camera,
  showRecenter,
  recentering,
  onRecenter,
  onTilesLoaded,
}: Props) {
  const map = useMap();

  useEffect(() => {
    if (!map || !camera) return;
    map.panTo(camera.center);
    map.setZoom(camera.zoom);
  }, [map, camera]);

  return (
    <>
      <Map
        className="h-full w-full"
        mapId={mapId}
        colorScheme={ColorScheme.LIGHT}
        defaultCenter={initialView.center}
        defaultZoom={initialView.zoom}
        disableDefaultUI
        gestureHandling="greedy"
        clickableIcons={false}
        onTilesLoaded={onTilesLoaded}
      >
        {userPosition && <UserDot position={userPosition} />}
      </Map>
      {showRecenter && <RecenterButton busy={recentering} onClick={onRecenter} />}
    </>
  );
}
