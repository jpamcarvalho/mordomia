"use client";

import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { MagnifierIcon } from "./search-modal";

type Props = {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  count: number;
  onShowList: () => void;
  onSearch: () => void;
  onNewRestaurant: () => void;
  // The round button itself (target of the "added" animation).
  buttonRef?: Ref<HTMLButtonElement>;
};

type ItemProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  // Stagger: the item nearest the button pops first.
  delayMs: number;
  badge?: number;
};

// One fork menu option. All options share the same size.
function MenuItem({ icon, label, onClick, delayMs, badge }: ItemProps) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delayMs}ms` }}
      className="flex h-14 w-52 items-center gap-3 rounded-2xl bg-white pr-4 pl-2.5 text-left text-[15px] font-semibold text-foreground shadow-lg ring-1 ring-black/5 transition-transform active:scale-95 motion-safe:animate-[fork-pop_200ms_cubic-bezier(0.2,0.9,0.3,1.2)_both]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-6 rounded-full bg-accent px-1.5 py-0.5 text-center text-xs font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

// The fork menu: round knife-and-fork button (bottom-right). Tapping it pops Search, New restaurant and My list up above it.
export function ListFab({
  open,
  onToggle,
  onClose,
  count,
  onShowList,
  onSearch,
  onNewRestaurant,
  buttonRef,
}: Props) {
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
        <>
          {/* Dims the map so the options stand out; tapping it closes the menu. */}
          <div
            aria-hidden="true"
            onClick={onClose}
            className="fixed inset-0 -z-10 bg-black/25 motion-safe:animate-[fade-in_150ms_ease-out]"
          />
          <div role="menu" aria-label="Lista" className="flex flex-col items-end gap-2.5">
            <MenuItem icon={<MagnifierIcon className="size-5" />} label="Pesquisar" onClick={onSearch} delayMs={80} />
            <MenuItem icon={<PinPlusIcon />} label="Novo restaurante" onClick={onNewRestaurant} delayMs={40} />
            <MenuItem icon={<ListIcon />} label="A minha lista" onClick={onShowList} delayMs={0} badge={count} />
          </div>
        </>
      )}
      <button
        type="button"
        aria-label={open ? "Fechar menu da lista" : "Abrir menu da lista"}
        aria-haspopup="menu"
        aria-expanded={open}
        ref={buttonRef}
        onClick={onToggle}
        className={`flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition ${
          open ? "ring-4 ring-white" : ""
        }`}
      >
        <CutleryIcon className={`size-7 transition-transform duration-200 ${open ? "-rotate-12" : ""}`} />
      </button>
    </div>
  );
}

// public/icons/cutlery.png, used as a mask so it takes the text color.
export function CutleryIcon({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} bg-current [mask:url(/icons/cutlery.png)_center/contain_no-repeat]`}
    />
  );
}

function PinPlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <path d="M12 6.5v6M9 9.5h6" />
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
