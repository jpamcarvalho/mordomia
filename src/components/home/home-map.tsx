"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addToList, createRestaurant, createRestaurantFromLink, removeFromList, type CreateResult } from "@/app/(home)/actions";
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
import { ALL_LISTS, parseShownLists, shownPlaces, type ShownLists } from "@/lib/map/my-places";
import { homePhase, type MapStatus } from "@/lib/map/phase";
import type { SelectedPlace } from "@/lib/map/restaurants";
import { AvatarLink } from "./avatar-link";
import { FlyingCutlery } from "./flying-cutlery";
import { ListChips } from "./list-chips";
import { ListFab } from "./list-fab";
import { ListPanel } from "./list-panel";
import { LocationNotice } from "./location-notice";
import { MapError } from "./map-error";
import { MapView } from "./map-view";
import { NewRestaurantModal, type PinFromLink, type RestaurantDraft } from "./new-restaurant-modal";
import { PinPlacement } from "./pin-placement";
import { RecenterButton } from "./recenter-button";
import { FriendsButton } from "./friends-button";
import { SearchBar } from "./search-bar";
import { SearchModal } from "./search-modal";
import { PlaceDialog } from "./place-dialog";
import { Toast } from "./toast";

type Props = {
  username: string | null;
  avatarUrl: string | null;
  initialList: ListItem[]; initialCustomPlaces: SelectedPlace[];
  // Friend requests received and friends' latest list times, for the social button's badge.
  socialPulse: { requests: number; feedTimes: string[] } };

const TOAST_MS = 2500;
// Which lists show on the map, remembered on this device.
const SHOWN_KEY = "mordomia.mapLists";

// Home screen orchestrator (design.md → HomeMap state machine; AC-3…AC-12).
export function HomeMap({ username, avatarUrl, initialList, initialCustomPlaces, socialPulse }: Props) {
  const [initialView, setInitialView] = useState<LocationState | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>("loading");
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [recentering, setRecentering] = useState(false);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  // A place just added from a link to "Minha lista": its popup opens on the rating form.
  const [formFirstId, setFormFirstId] = useState<string | null>(null);
  const [list, setList] = useState<ListItem[]>(initialList);
  const [fabOpen, setFabOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Restaurants added by users (shared), drawn on the map next to the OpenStreetMap ones.
  const [customPlaces, setCustomPlaces] = useState<SelectedPlace[]>(initialCustomPlaces);
  // Adding a restaurant — step 1: the form (draft = its values; null = closed).
  const [draft, setDraft] = useState<RestaurantDraft | null>(null);
  // Step 2: placing the pin near the user's position. `pin` follows the map center.
  // fromLink: placing a restaurant from a Google Maps link that had no position (no range limit).
  const [placing, setPlacing] = useState<
    (RestaurantDraft & { gps: LatLng; fromLink?: { link: string; status: ListStatus; address: string | null } }) | null
  >(null);
  const [placement, setPlacement] = useState<{ gps: LatLng; radiusM: number | null; zoom?: number } | null>(null);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [creating, startCreating] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<ListStatus | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // "Added" animation: a knife and fork flies from this point into the fork menu.
  const [flight, setFlight] = useState<{ x: number; y: number } | null>(null);
  const [shown, setShown] = useState<ShownLists>(savedShownLists);
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

  function toggleList(status: ListStatus) {
    setShown((current) => {
      const next = { ...current, [status]: !current[status] };
      try {
        localStorage.setItem(SHOWN_KEY, JSON.stringify(next));
      } catch {
        // Not remembered, still applied.
      }
      return next;
    });
  }

  const myPlaces = useMemo(() => shownPlaces(list, shown), [list, shown]);
  const listCounts = useMemo(
    () => ({
      saved: list.filter((item) => item.status === "saved").length,
      want: list.filter((item) => item.status === "want").length,
    }),
    [list],
  );

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

  // From a Google Maps link straight onto a list. "Quero ir!" is saved here; "Minha lista" opens the place on
  // its rating + notes form, like the popup does.
  function createFromLink(
    { status, needsPin, ...next }: RestaurantDraft & { link: string; status: ListStatus; needsPin: PinFromLink | null },
    origin: DOMRect,
  ) {
    if (needsPin) {
      startPlacingFromLink({ ...next, status }, needsPin);
      return;
    }
    saveFromLink(next, status, origin);
  }

  // A link without a position: place the pin anywhere, starting at the address guess (or the current area).
  function startPlacingFromLink(next: RestaurantDraft & { link: string; status: ListStatus }, { start, address }: PinFromLink) {
    const at = start ?? location?.userPosition ?? location?.center;
    if (!at) return;
    setDraft(null);
    setPlacing({ name: next.name, kinds: next.kinds, gps: at, fromLink: { link: next.link, status: next.status, address } });
    setPin(at);
    setPlacement({ gps: at, radiusM: null, zoom: start ? 17 : 15 });
  }

  function saveFromLink(
    next: RestaurantDraft & { link: string; lat?: number; lng?: number },
    status: ListStatus,
    origin: DOMRect,
  ) {
    startCreating(async () => {
      const result = await createRestaurantFromLink(next);
      if (!result.ok) {
        setToast(result.error);
        return;
      }
      const { place, existing } = result;
      if (!existing) setCustomPlaces((places) => [...places, place]);
      setDraft(null);
      stopPlacing();
      if (status === "saved") {
        setFormFirstId(place.id);
        setSelected(place);
        return;
      }
      const added = await addToList(place, "want");
      if (!added.ok) {
        setToast(added.error);
        setSelected(place);
        return;
      }
      setList((items) => [added.item, ...items.filter((item) => item.entryId !== added.item.entryId)]);
      setToast(`🤤 ${place.name} está no Quero ir!`);
      setCamera({ center: { lat: place.lat, lng: place.lng }, zoom: 16 });
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setFlight({ x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 });
      }
    });
  }

  // After a new restaurant is saved (pin or link): show it, celebrate, and open it so it can go onto a list.
  function added({ place, existing }: Extract<CreateResult, { ok: true }>, origin: DOMRect | null) {
    if (!existing) setCustomPlaces((places) => [...places, place]);
    setToast(existing ? `${place.name} já está no mapa` : `${place.name} adicionado ao mapa`);
    if (origin && !existing && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlight({ x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 });
    }
    setSelected(place);
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
    if (placing.fromLink) {
      const { link, status } = placing.fromLink;
      saveFromLink({ name: placing.name, kinds: placing.kinds, link, lat: pin.lat, lng: pin.lng }, status, origin);
      return;
    }
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
      stopPlacing();
      added(result, origin);
    });
  }
  const selectedItem = selected ? (list.find((item) => item.placeId === selected.id) ?? null) : null;

  function choose(status: ListStatus, details: EntryDetails | undefined, origin: DOMRect) {
    if (!selected || adding) return;
    setFormFirstId(null);
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
    setSelected(toPlace(item));
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
          myPlaces={placing ? [] : myPlaces}
          placement={placement}
          onPlacementMove={setPin}
          onLoad={onLoad}
          onError={fail}
          onSelect={(place) => {
            // A tapped list dot carries only the main type; take the full place from the list.
            const item = place && list.find((other) => other.placeId === place.id);
            setSelected(item ? toPlace(item) : place);
            setListOpen(false);
          }}
        />
      )}
      {phase === "map" && !placing && list.length > 0 && (
        <ListChips shown={shown} counts={listCounts} onToggle={toggleList} />
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
          startInForm={formFirstId === selected.id}
          onClose={() => {
            setSelected(null);
            setFormFirstId(null);
          }}
        />
      )}
      {phase === "map" && !placing && (
        <div
          className="absolute right-[calc(env(safe-area-inset-right)+1rem)] bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] z-20 flex flex-col items-end gap-3"
        >
          {!fabOpen && (
            <FriendsButton requests={socialPulse.requests} feedTimes={socialPulse.feedTimes} />
          )}
          <ListFab
            open={fabOpen}
            onToggle={() => setFabOpen((open) => !open)}
            onClose={closeFab}
            buttonRef={fabRef}
            onNewRestaurant={() => openNew("")}
            onShowList={() => {
              setFabOpen(false);
              setListOpen(true);
            }}
          />
        </div>
      )}
      {phase === "map" && !placing && !fabOpen && (
        <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+6.75rem)] left-[calc(env(safe-area-inset-left)+1rem)] z-20">
          <RecenterButton busy={recentering} onClick={recenter} />
        </div>
      )}
      {phase === "map" && !placing && !fabOpen && !listOpen && !searchOpen && (
        <SearchBar
          onOpen={() => {
            setSelected(null);
            setSearchOpen(true);
          }}
        />
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
        <NewRestaurantModal
          initial={draft}
          onNext={startPlacing}
          saving={creating}
          onSave={createFromLink}
          onClose={closeNew}
        />
      )}
      {phase === "map" && placing && pin && (
        <PinPlacement
          name={placing.name}
          kind={placing.kinds[0]}
          gps={placing.gps}
          pin={pin}
          saving={creating}
          onConfirm={create}
          free={placing.fromLink ? { address: placing.fromLink.address } : undefined}
          onRecenter={() =>
            setPlacement(
              placing.fromLink ? { gps: placing.gps, radiusM: null, zoom: 17 } : { gps: placing.gps, radiusM: PIN_RANGE_M },
            )
          }
          onBack={() => {
            const { name, kinds, fromLink } = placing;
            stopPlacing();
            setDraft({ name, kinds, link: fromLink?.link });
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

// The chips and list dots only render on the client (after the location reading), so the server value is never shown.
function savedShownLists(): ShownLists {
  try {
    return typeof window === "undefined" ? ALL_LISTS : parseShownLists(localStorage.getItem(SHOWN_KEY));
  } catch {
    return ALL_LISTS;
  }
}

function toPlace(item: ListItem): SelectedPlace {
  return { id: item.placeId, name: item.name, kind: item.kind ?? "restaurant", kinds: item.kinds, lat: item.lat, lng: item.lng };
}
