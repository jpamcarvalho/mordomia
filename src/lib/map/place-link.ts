import { isFoodClass, type SelectedPlace } from "./restaurants";

// "Ver no mapa" from elsewhere (e.g. an event's location): the home map opens with that place selected.

export function mapHref(place: SelectedPlace): string {
  const params = new URLSearchParams({
    lugar: place.id,
    nome: place.name,
    tipo: place.kind,
    lat: String(place.lat),
    lng: String(place.lng),
  });
  return `/?${params}`;
}

// The place in a "Ver no mapa" link, or null.
export function placeFromSearch(search: string): SelectedPlace | null {
  const params = new URLSearchParams(search);
  const id = params.get("lugar");
  const name = params.get("nome");
  const kind = params.get("tipo");
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!id || !name || !isFoodClass(kind) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { id, name, kind, lat, lng };
}
