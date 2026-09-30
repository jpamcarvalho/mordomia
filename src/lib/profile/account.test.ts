import { describe, expect, it } from "vitest";
import type { ListItem } from "@/lib/list/types";
import { BIO_MAX, accountStats, isOwnAvatarPath, levelFor, parseBio } from "./account";

const USER = "1b0c8a2e-0000-4000-8000-000000000001";

function item(entryId: string, status: ListItem["status"], rating: number | null = null): ListItem {
  return { entryId, status, placeId: entryId, name: `Place ${entryId}`, kind: null, lat: 41, lng: -8, rating, notes: null };
}

describe("parseBio", () => {
  it("trims and turns blank into null", () => {
    expect(parseBio("  Adoro francesinhas  ")).toEqual({ bio: "Adoro francesinhas" });
    expect(parseBio("   ")).toEqual({ bio: null });
    expect(parseBio(null)).toEqual({ bio: null });
  });

  it("rejects non-strings and bios over the limit", () => {
    expect(parseBio(42)).toBeNull();
    expect(parseBio("a".repeat(BIO_MAX + 1))).toBeNull();
    expect(parseBio("a".repeat(BIO_MAX))).toEqual({ bio: "a".repeat(BIO_MAX) });
  });
});

describe("isOwnAvatarPath", () => {
  it("accepts a file directly in the user's folder", () => {
    expect(isOwnAvatarPath(USER, `${USER}/1790800000000.jpg`)).toBe(true);
  });

  it("rejects other folders, nesting and odd names", () => {
    expect(isOwnAvatarPath(USER, "someone-else/1.jpg")).toBe(false);
    expect(isOwnAvatarPath(USER, `${USER}/a/b.jpg`)).toBe(false);
    expect(isOwnAvatarPath(USER, `${USER}/`)).toBe(false);
    expect(isOwnAvatarPath(USER, `${USER}/../x.jpg`)).toBe(false);
    expect(isOwnAvatarPath(USER, 7)).toBe(false);
  });
});

describe("accountStats", () => {
  it("counts both lists, averages the rated places and picks the top 3", () => {
    const stats = accountStats([
      item("a", "saved", 7),
      item("b", "saved", 10),
      item("c", "saved"),
      item("d", "saved", 8),
      item("e", "saved", 4),
      item("f", "want"),
    ]);
    expect(stats.went).toBe(5);
    expect(stats.want).toBe(1);
    expect(stats.average).toBe(7.3);
    expect(stats.favourites.map((f) => f.entryId)).toEqual(["b", "d", "a"]);
  });

  it("has no average when nothing is rated", () => {
    expect(accountStats([item("a", "saved"), item("b", "want")])).toMatchObject({ went: 1, want: 1, average: null, favourites: [] });
  });
});

describe("levelFor", () => {
  it("starts at the first level with the next goal", () => {
    expect(levelFor(0)).toMatchObject({ name: "A começar", from: 0, next: 5 });
  });

  it("moves up exactly at each threshold", () => {
    expect(levelFor(4).name).toBe("A começar");
    expect(levelFor(5)).toMatchObject({ name: "Provador", next: 15 });
    expect(levelFor(59).name).toBe("Gourmet");
  });

  it("has no next goal at the top", () => {
    expect(levelFor(200)).toMatchObject({ name: "Mordomo-mor", next: null });
  });
});
