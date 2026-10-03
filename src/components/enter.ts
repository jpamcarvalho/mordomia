import type { CSSProperties } from "react";

// Staggered entrance for each section of a profile page.
export const ENTER = "motion-safe:animate-[sheet-up_450ms_ease-out_both]";
export const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });
