// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");
const SELF = join(SRC, "app", "theme.test.ts");

// Built from parts so this file does not itself contain the patterns it forbids.
const DARK_VARIANT = new RegExp("\\bdark" + ":");
const DARK_MEDIA = new RegExp("prefers-color-scheme:\\s*" + "dark");

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const sourceFiles = listFiles(SRC).filter(
  (path) => /\.(tsx?|css)$/.test(path) && path !== SELF,
);

function offending(pattern: RegExp): string[] {
  return sourceFiles
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(SRC, path));
}

describe("AC-1: always-light theme", () => {
  it("has no Tailwind dark variant under src/", () => {
    expect(offending(DARK_VARIANT)).toEqual([]);
  });

  it("has no dark color-scheme media query under src/", () => {
    expect(offending(DARK_MEDIA)).toEqual([]);
  });

  it('declares colorScheme "only light" in the root viewport', () => {
    const layout = readFileSync(join(SRC, "app", "layout.tsx"), "utf8");
    const viewport = layout.match(/export const viewport: Viewport = \{([\s\S]*?)\};/);
    expect(viewport).not.toBeNull();
    expect(viewport![1]).toMatch(/colorScheme:\s*"only light"/);
  });
});
