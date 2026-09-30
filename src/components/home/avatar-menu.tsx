"use client";

import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/login/actions";
import { avatarInitial } from "@/lib/profile/avatar";

// Floating avatar button with the account menu (AC-10).
export function AvatarMenu({ username }: { username: string | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] z-20 flex flex-col items-end gap-2"
    >
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="flex size-12 items-center justify-center rounded-full bg-accent text-lg font-semibold text-white shadow-lg"
      >
        {avatarInitial(username)}
      </button>
      {open && (
        <div role="menu" className="min-w-40 rounded-xl bg-white py-2 text-sm shadow-lg">
          {username && <p className="px-4 py-2 font-medium">@{username}</p>}
          <form action={logout}>
            <button role="menuitem" className="w-full px-4 py-2 text-left hover:bg-neutral-100">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
