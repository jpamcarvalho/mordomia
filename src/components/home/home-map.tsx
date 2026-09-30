"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { addToList, createRestaurant, removeFromList } from "@/app/(home)/actions";
import { Splash } from "@/components/splash";
import type { EntryDetails } from "@/lib/list/details";
import { PIN_RANGE_M } from "@/lib/list/new-restaurant";
import type { ListItem, ListStatus } from "@/lib/list/types";
import {
  requestLocation,
  resolveInitialView,
  resolveRecenter,
  type Camera,
  type LatLng,
  type LocationResult,
  type LocationState,
} from "@/lib/map/location";
import { homePhase, type MapStatus } from "@/lib/map/phase";
import type { SelectedPlace } from "@/lib/map/restaurants";
import { AvatarLink } from "./avatar-link";
import { FlyingCutlery } from "./flying-cutlery";
import { ListFab } from "./list-fab";
import { ListPanel } from "./list-panel";
import { LocationNotice } from "./location-notice";
import { MapError } from "./map-error";
import { MapView } from "./map-view";
import { NewRestaurantModal, type RestaurantDraft } from "./new-restaurant-modal";
import { PinPlacement } from "./pin-placement";
import { RecenterButton } from "./recenter-button";
import { SearchModal } from "./search-modal";
import { PlaceDialog } from "./place-dialog";
import { Toast } from "./toast";

type Props = {
  username: string | null;
  avatarUrl: string | null;
  initialList: ListItem[]; initialCustomPlaces: SelectedPlace[] };

const TOAST_MS = 2500;

// Home screen orchestrator (design.md → HomeMap state machine; AC-3…AC-12).
export function HomeMap({ username, avatarUrl, initialList, initialCustomPlaces }: Props) {
  const [initialView, setInitialView] = useState<LocationState | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [recentering, setRecentering] = useState(false);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [list, setList] = useState<ListItem[]>(initialList);
  const [fabOpen, setFabOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Restaurants added by users (shared), drawn on the map next to the OpenStreetMap ones.
  const [customPlaces, setCustomPlaces] = useState<SelectedPlace[]>(initialCustomPlaces);
  // Adding a restaurant — step 1: the form (draft = its values; null = closed).
  const [draft, setDraft] = useState<RestaurantDraft | null>(null);
  // Step 2: placing the pin near the user's position. `pin` follows the map center.
  const [placing, setPlacing] = useState<(RestaurantDraft & { gps: LatLng }) | null>(null);
  const [placement, setPlacement] = useState<{ gps: LatLng; radiusM: number } | null>(null);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [creating, startCreating] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<ListStatus | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // "Added" animation: a knife and fork flies from this point into the fork menu.
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
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

  const onLoad = useCallback(
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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const closeFab = useCallback(() => setFabOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeNew = useCallback(() => setDraft(null), []);

  function openNew(name: string) {
    setFabOpen(false);
    setSearchOpen(false);
    setListOpen(false);
    setSelected(null);
    setDraft({ name, kinds: ["restaurant"] });
  }

  function startPlacing(next: RestaurantDraft & { gps: LatLng }) {
    setDraft(null);
    setPlacing(next);
    setPin(next.gps);
    setPlacement({ gps: next.gps, radiusM: PIN_RANGE_M });
  }

  function stopPlacing() {
    setPlacing(null);
    setPlacement(null);
    setPin(null);
  }

  function create(origin: DOMRect) {
    if (!placing || !pin) return;
    const restaurant = {
      name: placing.name,
      kinds: placing.kinds,
      lat: pin.lat,
      lng: pin.lng,
      gpsLat: placing.gps.lat,
      gpsLng: placing.gps.lng,
    };
    startCreating(async () => {
      const result = await createRestaurant(restaurant);
      if (!result.ok) {
        setToast(result.error);
        return;
      }
      const { place, existing } = result;
      if (!existing) setCustomPlaces((places) => [...places, place]);
      stopPlacing();
      setToast(existing ? `${place.name} já está no mapa` : `${place.name} adicionado ao mapa`);
      if (!existing && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setFlight({ x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 });
      }
      // Open it so it can go straight onto a list.
      setSelected(place);
    });
  }
  const selectedItem = selected ? (list.find((item) => item.placeId === selected.id) ?? null) : null;

  function choose(status: ListStatus, details: EntryDetails | undefined, origin: DOMRect) {
    if (!selected || adding) return;
    const place = selected;
    setPendingStatus(status);
    startAdding(async () => {
      const result = await addToList(place, status, details);
      setPendingStatus(null);
      if (!result.ok) {
        setToast(result.error);
        return;
      }
      setList((items) => [result.item, ...items.filter((item) => item.entryId !== result.item.entryId)]);
      setToast(status === "want" ? `🤤 ${place.name} está no Quero ir!` : `⭐ ${place.name} adicionado à tua lista`);
      setSelected(null);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setFlight({ x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 });
      }
    });
  }

  async function remove(item: ListItem) {
    setRemoving(item.entryId);
    const { ok } = await removeFromList(item.entryId);
    setRemoving(null);
    if (ok) setList((items) => items.filter((other) => other.entryId !== item.entryId));
    else setToast("Não foi possível remover. Tenta outra vez.");
  }

  function pick(item: ListItem) {
    setListOpen(false);
    setSelected({ id: item.placeId, name: item.name, kind: item.kind ?? "restaurant", kinds: item.kinds, lat: item.lat, lng: item.lng });
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-background">
      {initialView && location && (
        <MapView
          initialView={initialView}
          userPosition={location.userPosition}
          camera={camera}
          selected={selected}
          customPlaces={customPlaces}
          placement={placement}
          onPlacementMove={setPin}
          onLoad={onLoad}
          onError={fail}
          onSelect={(place) => {
            setSelected(place);
            setListOpen(false);
          }}
        />
      )}
      {phase === "map" && location?.showNotice && !noticeDismissed && (
        <LocationNotice onDismiss={() => setNoticeDismissed(true)} />
      )}
      {phase === "map" && selected && (
        <PlaceDialog
          place={selected}
          key={selected.id}
          current={selectedItem}
          pending={pendingStatus}
          onChoose={choose}
          onClose={() => setSelected(null)}
        />
      )}
      {phase === "map" && !placing && (
        <div
          className="absolute right-[calc(env(safe-area-inset-right)+1rem)] bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] z-20 flex flex-col items-end gap-3"
        >
          {!fabOpen && <RecenterButton busy={recentering} onClick={recenter} />}
          <ListFab
            open={fabOpen}
            onToggle={() => setFabOpen((open) => !open)}
            onClose={closeFab}
            count={list.length}
            buttonRef={fabRef}
            onNewRestaurant={() => openNew("")}
            onSearch={() => {
              setFabOpen(false);
              setListOpen(false);
              setSearchOpen(true);
            }}
            onShowList={() => {
              setFabOpen(false);
              setListOpen(true);
            }}
          />
        </div>
      )}
      {phase === "map" && listOpen && (
        <ListPanel
          items={list}
          removing={removing}
          onPick={pick}
          onRemove={remove}
          onClose={() => setListOpen(false)}
        />
      )}
      {phase === "map" && searchOpen && location && (
        <SearchModal
          near={location.userPosition ?? location.center}
          onPick={(result) => {
            setSearchOpen(false);
            setSelected({ id: result.id, name: result.name, kind: result.kind, kinds: result.kinds, lat: result.lat, lng: result.lng });
          }}
          onAddNew={openNew}
          onClose={closeSearch}
        />
      )}
      {phase === "map" && draft !== null && (
        <NewRestaurantModal initial={draft} onNext={startPlacing} onClose={closeNew} />
      )}
      {phase === "map" && placing && pin && (
        <PinPlacement
          name={placing.name}
          kind={placing.kinds[0]}
          gps={placing.gps}
          pin={pin}
          saving={creating}
          onConfirm={create}
          onRecenter={() => setPlacement({ gps: placing.gps, radiusM: PIN_RANGE_M })}
          onBack={() => {
            const { name, kinds } = placing;
            stopPlacing();
            setDraft({ name, kinds });
          }}
        />
      )}
      {flight && <FlyingCutlery from={flight} target={fabRef} onDone={() => setFlight(null)} />}
      {toast && <Toast message={toast} />}
      {phase === "error" && <MapError />}
      {phase !== "splash" && !placing && <AvatarLink username={username} avatarUrl={avatarUrl} />}
      {phase === "splash" && <Splash />}
    </main>
  );
}
