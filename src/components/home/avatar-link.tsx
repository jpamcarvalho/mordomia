import Link from "next/link";
import { avatarInitial } from "@/lib/profile/avatar";

// Floating avatar button (top-right): opens the account page, where the user can also sign out.
export function AvatarLink({ username, avatarUrl }: { username: string | null; avatarUrl: string | null }) {
  return (
    <Link
      href="/account"
      aria-label="A minha conta"
      className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] z-20 flex size-12 items-center justify-center overflow-hidden rounded-full bg-accent text-lg font-semibold text-white shadow-lg ring-2 ring-white transition active:scale-95"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        avatarInitial(username)
      )}
    </Link>
  );
}
