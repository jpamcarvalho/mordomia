"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { MAP_STYLE_URL, toMapLibreZoom } from "@/lib/map/config";
import type { Camera, LatLng, LocationState } from "@/lib/map/location";
import { FOOD_CLASSES, toSelectedPlace, type SelectedPlace } from "@/lib/map/restaurants";

const FOOD_LAYER = "food-poi";
// Extra pixels around a tap so small pins are easy to hit on a phone.
const TAP_SLOP = 12;
// Served from public/ (scripts/copy-maplibre-worker.mjs); the bundled default URL does not resolve.
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

type Props = {
  // Initial view only; later moves go through `camera`.
  initialView: LocationState;
  userPosition: LatLng | null;
  // Latest camera move requested by HomeMap (recenter, late location); a new object means a new move.
  camera: Camera | null;
  selected: SelectedPlace | null;
  onLoad: () => void;
  onError: () => void;
  onSelect: (place: SelectedPlace | null) => void;
};

function addFoodLayer(map: maplibregl.Map) {
  map.addLayer({
    id: FOOD_LAYER,
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "poi",
    minzoom: 14,
    filter: ["match", ["get", "class"], [...FOOD_CLASSES], true, false],
    layout: {
      "icon-image": ["get", "class"],
      "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 0.8],
      "text-max-width": 8,
      "text-optional": true,
    },
    paint: {
      "text-color": "#8a4b2a",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.2,
    },
  });
}

function dotElement() {
  const el = document.createElement("div");
  el.dataset.testid = "user-dot";
  el.className = "size-4 rounded-full border-2 border-white bg-blue-500 shadow-md";
  return el;
}

// The MapLibre map (OpenFreeMap tiles), the user dot, food-place pins and the selection pin.
export function MapView({
  initialView,
  userPosition,
  camera,
  selected,
  onLoad,
  onError,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const dotRef = useRef<maplibregl.Marker | null>(null);
  const pinRef = useRef<maplibregl.Marker | null>(null);
  // Callbacks change identity across renders; the map listeners read the latest ones.
  const handlers = useRef({ onLoad, onError, onSelect });
  useEffect(() => {
    handlers.current = { onLoad, onError, onSelect };
  });

  useEffect(() => {
    maplibregl.setWorkerUrl(WORKER_URL);
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: MAP_STYLE_URL,
      center: [initialView.center.lng, initialView.center.lat],
      zoom: toMapLibreZoom(initialView.zoom),
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;

    let loaded = false;
    // Added before the first tiles are parsed: workers only decode source layers the style uses.
    map.on("style.load", () => {
      if (!map.getLayer(FOOD_LAYER)) addFoodLayer(map);
    });
    map.on("load", () => {
      loaded = true;
      handlers.current.onLoad();
    });
    // Style or first tiles failing before the map is up → error state. Later tile hiccups are ignored.
    map.on("error", () => {
      if (!loaded) handlers.current.onError();
    });

    map.on("click", (event) => {
      if (!map.getLayer(FOOD_LAYER)) return;
      const { x, y } = event.point;
      const [feature] = map.queryRenderedFeatures(
        [
          [x - TAP_SLOP, y - TAP_SLOP],
          [x + TAP_SLOP, y + TAP_SLOP],
        ],
        { layers: [FOOD_LAYER] },
      );
      if (!feature) {
        handlers.current.onSelect(null);
        return;
      }
      const at =
        feature.geometry.type === "Point"
          ? { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }
          : event.lngLat;
      handlers.current.onSelect(toSelectedPlace(feature, at));
    });
    map.on("mouseenter", FOOD_LAYER, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", FOOD_LAYER, () => (map.getCanvas().style.cursor = ""));

    return () => {
      map.remove();
      mapRef.current = null;
      dotRef.current = null;
      pinRef.current = null;
    };
    // The map is created once; initialView is only its starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !camera) return;
    map.easeTo({ center: [camera.center.lng, camera.center.lat], zoom: toMapLibreZoom(camera.zoom) });
  }, [camera]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userPosition) {
      dotRef.current?.remove();
      dotRef.current = null;
      return;
    }
    const lngLat: [number, number] = [userPosition.lng, userPosition.lat];
    if (dotRef.current) dotRef.current.setLngLat(lngLat);
    else dotRef.current = new maplibregl.Marker({ element: dotElement() }).setLngLat(lngLat).addTo(map);
  }, [userPosition]);

  useEffect(() => {
    const map = mapRef.current;
    pinRef.current?.remove();
    pinRef.current = null;
    if (!map || !selected) return;
    pinRef.current = new maplibregl.Marker({ color: "#c2410c" })
      .setLngLat([selected.lng, selected.lat])
      .addTo(map);
    map.easeTo({
      center: [selected.lng, selected.lat],
      zoom: Math.max(map.getZoom(), 15),
      // Keep the pin in the top quarter, clear of the centered dialog.
      padding: { bottom: map.getContainer().clientHeight / 2 },
    });
  }, [selected]);

  return <div ref={containerRef} className="h-full w-full" />;
}
