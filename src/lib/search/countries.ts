// Countries the restaurant search can be limited to. Photon filters by code; bbox = [minLng, minLat, maxLng, maxLat]
// only places user-added restaurants (no country stored), generous so islands are included (Açores, Madeira…).
export type Country = { code: string; name: string; flag: string; bbox: [number, number, number, number] };

export const COUNTRIES: readonly Country[] = [
  { code: "PT", name: "Portugal", flag: "🇵🇹", bbox: [-31.6, 32.3, -6.1, 42.2] },
  { code: "ES", name: "Espanha", flag: "🇪🇸", bbox: [-18.4, 27.5, 4.4, 43.9] },
  { code: "FR", name: "França", flag: "🇫🇷", bbox: [-5.3, 41.3, 9.7, 51.2] },
  { code: "IT", name: "Itália", flag: "🇮🇹", bbox: [6.6, 35.4, 18.6, 47.1] },
  { code: "GB", name: "Reino Unido", flag: "🇬🇧", bbox: [-8.7, 49.8, 1.8, 60.9] },
  { code: "IE", name: "Irlanda", flag: "🇮🇪", bbox: [-10.7, 51.4, -5.9, 55.4] },
  { code: "DE", name: "Alemanha", flag: "🇩🇪", bbox: [5.8, 47.2, 15.1, 55.1] },
  { code: "NL", name: "Países Baixos", flag: "🇳🇱", bbox: [3.3, 50.7, 7.3, 53.6] },
  { code: "BE", name: "Bélgica", flag: "🇧🇪", bbox: [2.5, 49.4, 6.5, 51.6] },
  { code: "CH", name: "Suíça", flag: "🇨🇭", bbox: [5.9, 45.8, 10.5, 47.9] },
  { code: "BR", name: "Brasil", flag: "🇧🇷", bbox: [-74.1, -33.8, -28.8, 5.3] },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸", bbox: [-179.2, 18.9, -66.9, 71.4] },
];

export function findCountry(code: unknown): Country | null {
  return COUNTRIES.find((country) => country.code === code) ?? null;
}

export function inCountryBox(country: Country, point: { lat: number; lng: number }): boolean {
  const [minLng, minLat, maxLng, maxLat] = country.bbox;
  return point.lng >= minLng && point.lng <= maxLng && point.lat >= minLat && point.lat <= maxLat;
}
