"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import type { LatLng } from "@/lib/map/location";

// Blue "you are here" dot (AC-5), anchored at its center.
export function UserDot({ position }: { position: LatLng }) {
  return (
    <AdvancedMarker position={position} anchorLeft="-50%" anchorTop="-50%" clickable={false}>
      <div
        data-testid="user-dot"
        className="size-4 rounded-full border-2 border-white bg-blue-500 shadow-md"
      />
    </AdvancedMarker>
  );
}
