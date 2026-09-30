// MapLibre v6 loads its web worker from a URL next to its own module, which bundling breaks.
// Copy the worker (and the chunk it imports) to public/ so the app can point MapLibre at it.
import { cpSync, mkdirSync } from "node:fs";

const from = "node_modules/maplibre-gl/dist";
const to = "public/maplibre";
mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(`${from}/${file}`, `${to}/${file}`);
}
