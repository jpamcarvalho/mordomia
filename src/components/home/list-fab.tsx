"use client";

import { useEffect, useRef } from "react";
import { MagnifierIcon } from "./search-modal";

type Props = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  count: number;
  onAdd: () => void;
  onShowList: () => void;
  onSearch: () => void;
};

const pill =
  "flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-foreground shadow-lg disabled:opacity-60";

// The fork menu: round knife-and-fork button (bottom-right). Tapping it pops Search, My list and Add up above it.
export function ListFab({ open, onToggle, onClose, count, onAdd, onShowList, onSearch }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="flex flex-col items-end gap-3">
      {open && (
        <div role="menu" aria-label="List" className="flex flex-col items-end gap-3">
          <button role="menuitem" type="button" className={pill} onClick={onSearch}>
            <MagnifierIcon className="size-5" />
            Search
          </button>
          <button role="menuitem" type="button" className={pill} onClick={onShowList}>
            <ListIcon />
            My list
            {count > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">{count}</span>
            )}
          </button>
          <button role="menuitem" type="button" className={pill} onClick={onAdd}>
            <PlusIcon />
            Add
          </button>
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "Close list menu" : "Open list menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className="flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg"
      >
        <CutleryIcon className="size-7" />
      </button>
    </div>
  );
}

// public/icons/cutlery.png, used as a mask so it takes the text color.
function CutleryIcon({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} bg-current [mask:url(/icons/cutlery.png)_center/contain_no-repeat]`}
    />
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}
