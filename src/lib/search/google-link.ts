// Google Maps share links ("Não o encontras?" → paste the link): find one in pasted text and read the place from it.

// position: the exact spot, when the link has one. Some Maps shares ("?q=Name, address&ftid=…") only carry the
// name and address; then position is null, guess is a rough spot for the address and the user places the pin.
export type LinkPlace = {
  name: string | null;
  address: string | null;
  position: { lat: number; lng: number } | null;
  guess: { lat: number; lng: number } | null;
};

// The Maps app shares "Name\nAddress\nhttps://maps.app.goo.gl/…"; take the first URL in the text.
const URL_RE = /https?:\/\/[^\s<>"']+/i;

// Only Google Maps hosts are ever fetched (the server follows short-link redirects).
export function isGoogleMapsUrl(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");
  // google.com, google.pt, google.co.uk… with or without www / maps.
  if (/^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) {
    return host.startsWith("maps.") || url.pathname.startsWith("/maps");
  }
  return false;
}

// share.google links (Google app / Search "Share") only lead to a Google search with the name, never a
// position, so they can't be used; the user is asked to share from Google Maps instead.
export function isGoogleSearchShare(text: string): boolean {
  const match = text.match(URL_RE);
  if (!match) return false;
  try {
    return new URL(match[0]).hostname.toLowerCase() === "share.google";
  } catch {
    return false;
  }
}

// The Google Maps link inside pasted text, or null.
export function findGoogleMapsLink(text: string): URL | null {
  const match = text.match(URL_RE);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    return isGoogleMapsUrl(url) ? url : null;
  } catch {
    return null;
  }
}

function coord(lat: string, lng: string): { lat: number; lng: number } | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

// Reads the place from a full Google Maps URL; null when it has neither a position nor a name (e.g. an
// unresolved short link). Position: the place pin (!3d…!4d…) first, then ?q= / ?query= coordinates, then the
// map center (@lat,lng).
export function parseGoogleMapsUrl(url: URL): LinkPlace | null {
  const path = decodeURIComponent(url.pathname.replace(/\+/g, " "));
  const nameMatch = path.match(/\/maps\/place\/([^/]+)/);
  let name = nameMatch ? nameMatch[1].trim() : null;
  let address: string | null = null;
  // A dropped pin's "place" is just its coordinates.
  if (name && /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(name)) name = null;

  const full = decodeURIComponent(url.href);
  const pins = [...full.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  const pin = pins.length ? coord(pins[pins.length - 1][1], pins[pins.length - 1][2]) : null;

  const q = url.searchParams.get("q") ?? url.searchParams.get("query") ?? url.searchParams.get("ll");
  const qMatch = q?.match(/^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/);
  const fromQuery = qMatch ? coord(qMatch[1], qMatch[2]) : null;
  // "?q=Ponto F, R. Cavadas 36, 4430-357 Vila Nova de Gaia": the name, then the address.
  if (!name && q && !qMatch) {
    const [first, ...rest] = q.split(",");
    name = first.trim() || null;
    address = rest.join(",").trim() || null;
  }

  const at = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const center = at ? coord(at[1], at[2]) : null;

  const position = pin ?? fromQuery ?? center;
  if (!position && !name) return null;
  return { name: name ? name.slice(0, 100) : null, address: address ? address.slice(0, 200) : null, position, guess: null };
}
