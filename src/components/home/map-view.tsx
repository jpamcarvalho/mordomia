"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { MAP_STYLE_URL, toMapLibreZoom } from "@/lib/map/config";
import type { Camera, LatLng, LocationState } from "@/lib/map/location";
import { circleRing } from "@/lib/list/new-restaurant";
import { FOOD_CLASSES, toSelectedPlace, type SelectedPlace } from "@/lib/map/restaurants";
import type { ListItem } from "@/lib/list/types";
import { myPlacesData, STATUS_COLORS } from "@/lib/map/my-places";

const FOOD_LAYER = "food-poi";
// Restaurants added by users (not in OpenStreetMap), from our database.
const CUSTOM_SOURCE = "custom-places";
const CUSTOM_LAYER = "custom-poi";
// The user's own list places, colored by list, drawn above every other pin.
const MY_SOURCE = "my-places";
const MY_DOTS = "my-places-dots";
const MY_LABELS = "my-places-labels";
const PLACE_LAYERS = [MY_DOTS, MY_LABELS, CUSTOM_LAYER, FOOD_LAYER];
// Allowed area while placing a new restaurant's pin.
const RANGE_SOURCE = "pin-range";
const RANGE_LAYERS = ["pin-range-fill", "pin-range-line"];
// Close enough to pick the right door (MapLibre scale).
const PLACEMENT_ZOOM = 18;
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
  customPlaces: SelectedPlace[];
  // The user's list places to draw (already filtered by the shown lists).
  myPlaces: ListItem[];
  // Placing a new restaurant: camera goes to gps and the range circle is drawn. A new object re-centers (Reset).
  // radiusM null: no range (a restaurant from a link is placed anywhere); zoom: starting zoom (MapLibre scale).
  placement: { gps: LatLng; radiusM: number | null; zoom?: number } | null;
  // The pin is the map center; reported on every move while placing.
  onPlacementMove: (center: LatLng) => void;
  onLoad: () => void;
  onError: () => void;
  onSelect: (place: SelectedPlace | null) => void;
};

const PLACE_LAYOUT = {
  "icon-image": ["get", "class"],
  "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
  "text-font": ["Noto Sans Regular"],
  "text-size": 11,
  "text-anchor": "top",
  "text-offset": [0, 0.8],
  "text-max-width": 8,
  "text-optional": true,
} satisfies maplibregl.SymbolLayerSpecification["layout"];

const PLACE_PAINT = {
  "text-color": "#8a4b2a",
  "text-halo-color": "#ffffff",
  "text-halo-width": 1.2,
} satisfies maplibregl.SymbolLayerSpecification["paint"];

function addFoodLayer(map: maplibregl.Map) {
  map.addLayer({
    id: FOOD_LAYER,
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "poi",
    minzoom: 14,
    filter: ["match", ["get", "class"], [...FOOD_CLASSES], true, false],
    layout: PLACE_LAYOUT,
    paint: PLACE_PAINT,
  });
}

function customPlacesData(places: SelectedPlace[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [place.lng, place.lat] },
      properties: { placeId: place.id, name: place.name, class: place.kind },
    })),
  };
}

function addCustomLayer(map: maplibregl.Map, places: SelectedPlace[]) {
  map.addSource(CUSTOM_SOURCE, { type: "geojson", data: customPlacesData(places) });
  map.addLayer({
    id: CUSTOM_LAYER,
    type: "symbol",
    source: CUSTOM_SOURCE,
    minzoom: 13,
    // Drawn before the tile pins where they collide: users added these on purpose.
    layout: { ...PLACE_LAYOUT, "symbol-sort-key": 0 },
    paint: PLACE_PAINT,
  });
}

const STATUS_COLOR = ["match", ["get", "status"], "want", STATUS_COLORS.want, STATUS_COLORS.saved] as maplibregl.ExpressionSpecification;

function addMyPlacesLayers(map: maplibregl.Map, places: ListItem[]) {
  map.addSource(MY_SOURCE, { type: "geojson", data: myPlacesData(places) });
  map.addLayer({
    id: MY_DOTS,
    type: "circle",
    source: MY_SOURCE,
    paint: {
      "circle-color": STATUS_COLOR,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 12, 6, 16, 9],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: MY_LABELS,
    type: "symbol",
    source: MY_SOURCE,
    minzoom: 12,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 0.9],
      "text-max-width": 8,
      "text-optional": true,
    },
    paint: { "text-color": STATUS_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
  });
}

// Hides the regular pin of places already drawn as the user's own, so each place shows once.
function hideListedPins(map: maplibregl.Map, places: ListItem[]) {
  const ids: maplibregl.ExpressionSpecification = ["literal", places.map((place) => place.placeId)];
  if (map.getLayer(FOOD_LAYER))
    map.setFilter(FOOD_LAYER, [
      "all",
      ["match", ["get", "class"], [...FOOD_CLASSES], true, false],
      ["!", ["in", ["to-string", ["id"]], ids]],
    ]);
  if (map.getLayer(CUSTOM_LAYER))
    map.setFilter(CUSTOM_LAYER, ["!", ["in", ["get", "placeId"], ids]]);
}

function rangeData(center: LatLng, radiusM: number): GeoJSON.Feature {
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circleRing(center, radiusM)] } };
}

function showRange(map: maplibregl.Map, center: LatLng, radiusM: number) {
  const source = map.getSource(RANGE_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(rangeData(center, radiusM));
    return;
  }
  map.addSource(RANGE_SOURCE, { type: "geojson", data: rangeData(center, radiusM) });
  map.addLayer({ id: RANGE_LAYERS[0], type: "fill", source: RANGE_SOURCE, paint: { "fill-color": "#c2410c", "fill-opacity": 0.08 } });
  map.addLayer({
    id: RANGE_LAYERS[1],
    type: "line",
    source: RANGE_SOURCE,
    paint: { "line-color": "#c2410c", "line-width": 2, "line-dasharray": [2, 2] },
  });
}

function hideRange(map: maplibregl.Map) {
  for (const layer of RANGE_LAYERS) if (map.getLayer(layer)) map.removeLayer(layer);
  if (map.getSource(RANGE_SOURCE)) map.removeSource(RANGE_SOURCE);
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
  customPlaces,
  myPlaces,
  placement,
  onPlacementMove,
  onLoad,
  onError,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const dotRef = useRef<maplibregl.Marker | null>(null);
  const pinRef = useRef<maplibregl.Marker | null>(null);
  // Callbacks change identity across renders; the map listeners read the latest ones.
  const handlers = useRef({ onLoad, onError, onSelect, onPlacementMove });
  const placingRef = useRef(false);
  // Latest user-added places, for the style.load handler that adds the layer.
  const customRef = useRef(customPlaces);
  useEffect(() => {
    customRef.current = customPlaces;
    const source = mapRef.current?.getSource(CUSTOM_SOURCE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(customPlacesData(customPlaces));
  }, [customPlaces]);
  const myRef = useRef(myPlaces);
  useEffect(() => {
    myRef.current = myPlaces;
    const map = mapRef.current;
    const source = map?.getSource(MY_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!map || !source) return;
    source.setData(myPlacesData(myPlaces));
    hideListedPins(map, myPlaces);
  }, [myPlaces]);
  useEffect(() => {
    handlers.current = { onLoad, onError, onSelect, onPlacementMove };
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
      if (!map.getLayer(CUSTOM_LAYER)) addCustomLayer(map, customRef.current);
      if (!map.getLayer(MY_DOTS)) addMyPlacesLayers(map, myRef.current);
      hideListedPins(map, myRef.current);
    });
    map.on("load", () => {
      loaded = true;
      handlers.current.onLoad();
    });
    // Style or first tiles failing before the map is up → error state. Later tile hiccups are ignored.
    map.on("error", () => {
      if (!loaded) handlers.current.onError();
    });

    // While placing a pin the map is only moved, never tapped to select places.
    map.on("move", () => {
      if (!placingRef.current) return;
      const { lat, lng } = map.getCenter();
      handlers.current.onPlacementMove({ lat, lng });
    });

    map.on("click", (event) => {
      if (placingRef.current || !map.getLayer(FOOD_LAYER)) return;
      const { x, y } = event.point;
      const [feature] = map.queryRenderedFeatures(
        [
          [x - TAP_SLOP, y - TAP_SLOP],
          [x + TAP_SLOP, y + TAP_SLOP],
        ],
        { layers: PLACE_LAYERS },
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
    for (const layer of PLACE_LAYERS) {
      map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
    }

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
    placingRef.current = placement !== null;
    if (!map) return;
    if (!placement) {
      hideRange(map);
      return;
    }
    if (placement.radiusM === null) hideRange(map);
    else showRange(map, placement.gps, placement.radiusM);
    // No padding: the pin drawn in the middle of the screen must be the map center.
    map.easeTo({
      center: [placement.gps.lng, placement.gps.lat],
      zoom: placement.zoom ?? PLACEMENT_ZOOM,
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      duration: 600,
    });
  }, [placement]);

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
