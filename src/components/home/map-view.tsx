"use client";

import { ColorScheme, Map, useMap } from "@vis.gl/react-google-maps";
import type { Camera, LocationState } from "@/lib/map/location";
import { RecenterButton } from "./recenter-button";
import { UserDot } from "./user-dot";

type Props = {
  mapId: string;
  // Initial view only (used as defaultCenter / defaultZoom); later moves go through the recenter camera.
  initialView: LocationState;
  userPosition: LocationState["userPosition"];
  showRecenter: boolean;
  recentering: boolean;
  onRecenter: () => Promise<Camera>;
  onTilesLoaded: () => void;
};

// The Google map, the user dot and the recenter wiring (needs useMap(), so it lives inside APIProvider).
export function MapView({
  mapId,
  initialView,
  userPosition,
  showRecenter,
  recentering,
  onRecenter,
  onTilesLoaded,
}: Props) {
  const map = useMap();

  async function recenter() {
    const camera = await onRecenter();
    map?.panTo(camera.center);
    map?.setZoom(camera.zoom);
  }

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
      {showRecenter && <RecenterButton busy={recentering} onClick={recenter} />}
    </>
  );
}
