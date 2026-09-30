import { describe, expect, it } from "vitest";
import { rankResults, toSearchResult } from "./photon";

const CHUPITOS = {
  properties: {
    osm_type: "N",
    osm_id: 6181655185,
    osm_key: "amenity",
    osm_value: "bar",
    name: "Chupitos bar",
    street: "Rua dos Mártires da Liberdade",
    housenumber: "90",
    locality: "Baixa do Porto",
    county: "Porto",
  },
  geometry: { type: "Point", coordinates: [-8.6142122, 41.1507861] },
};

describe("toSearchResult", () => {
  it("maps a Photon feature to a place with the map's feature id", () => {
    expect(toSearchResult(CHUPITOS)).toEqual({
      id: "61816551851",
      name: "Chupitos bar",
      kind: "bar",
      lat: 41.1507861,
      lng: -8.6142122,
      address: "Rua dos Mártires da Liberdade 90, Baixa do Porto",
    });
  });

  it("uses the way/relation digits", () => {
    const way = { ...CHUPITOS, properties: { ...CHUPITOS.properties, osm_type: "W" } };
    expect(toSearchResult(way)?.id).toBe("61816551852");
  });

  it("maps pubs and bakeries", () => {
    const pub = { ...CHUPITOS, properties: { ...CHUPITOS.properties, osm_value: "pub" } };
    const bakery = { ...CHUPITOS, properties: { ...CHUPITOS.properties, osm_key: "shop", osm_value: "bakery" } };
    expect(toSearchResult(pub)?.kind).toBe("beer");
    expect(toSearchResult(bakery)?.kind).toBe("bakery");
  });

  it("drops non-food and unnamed results", () => {
    const shop = { ...CHUPITOS, properties: { ...CHUPITOS.properties, osm_key: "shop", osm_value: "clothes" } };
    const unnamed = { ...CHUPITOS, properties: { ...CHUPITOS.properties, name: " " } };
    expect(toSearchResult(shop)).toBeNull();
    expect(toSearchResult(unnamed)).toBeNull();
  });

  it("does not repeat a house number already in the street", () => {
    const glued = { ...CHUPITOS, properties: { ...CHUPITOS.properties, street: "Rua X90" } };
    expect(toSearchResult(glued)?.address).toBe("Rua X90, Baixa do Porto");
  });

  it("has no address when Photon gives none", () => {
    const bare = { ...CHUPITOS, properties: { osm_type: "N", osm_id: 1, osm_key: "amenity", osm_value: "cafe", name: "X" } };
    expect(toSearchResult(bare)?.address).toBeNull();
  });
});

describe("rankResults", () => {
  const names = (list: { name: string }[]) => list.map((r) => r.name);

  it("puts the exact name first, then prefix, then word matches, keeping Photon order within each", () => {
    const results = [
      { name: "Ponto Dois" },
      { name: "Café Ponto F" },
      { name: "Ponto Final" },
      { name: "ponto  f" },
      { name: "Ponto Fresco" },
    ];
    expect(names(rankResults(results, "Ponto F"))).toEqual([
      "ponto  f",
      "Ponto Final",
      "Ponto Fresco",
      "Café Ponto F",
      "Ponto Dois",
    ]);
  });

  it("ignores accents and case", () => {
    expect(names(rankResults([{ name: "Cafe X" }, { name: "Café" }], "CAFE"))).toEqual(["Café", "Cafe X"]);
  });
});
