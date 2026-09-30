"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CutleryIcon } from "./list-fab";

type Point = { x: number; y: number };

type Props = {
  // Viewport point the icon starts from (the button that saved the place).
  from: Point;
  // The fork menu button it flies into.
  target: RefObject<HTMLElement | null>;
  onDone: () => void;
};

const FLIGHT_MS = 700;
const ARC_HEIGHT = 140;
const STEPS = 16;

// Point on a quadratic Bézier curve.
function bezier(a: Point, control: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
  };
}

// After adding a restaurant: a knife and fork arcs from the dialog into the fork menu, which then bounces.
export function FlyingCutlery({ from, target, onDone }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const el = ref.current;
    const fab = target.current;
    if (!el || !fab) {
      done.current();
      return;
    }
    const rect = fab.getBoundingClientRect();
    const to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - ARC_HEIGHT };

    const keyframes = Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = i / STEPS;
      const { x, y } = bezier(from, control, to, t);
      const scale = t < 0.2 ? 1 + t * 2 : 1.4 - (t - 0.2) * 1.2; // grow a little, then shrink into the button
      return {
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${t * 360}deg) scale(${scale})`,
        opacity: t > 0.92 ? 0 : 1,
      };
    });

    const flight = el.animate(keyframes, { duration: FLIGHT_MS, easing: "cubic-bezier(0.45, 0, 0.35, 1)", fill: "forwards" });
    flight.onfinish = () => {
      fab.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.3)" },
          { transform: "scale(0.92)" },
          { transform: "scale(1.06)" },
          { transform: "scale(1)" },
        ],
        { duration: 450, easing: "ease-out" },
      );
      done.current();
    };
    return () => flight.cancel();
  }, [from, target]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-50 flex size-12 items-center justify-center rounded-full bg-accent text-white shadow-xl"
      style={{ transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%)` }}
    >
      <CutleryIcon className="size-6" />
    </span>
  );
}
