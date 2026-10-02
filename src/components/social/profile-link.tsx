import Link from "next/link";
import type { Person } from "@/lib/social/people";

export function profileHref(username: string): string {
  return `/social/pessoa/${encodeURIComponent(username)}`;
}

// Opens a person's profile (mine redirects to /account). Never put it inside another link or button.
export function ProfileLink({
  person,
  className = "",
  children,
}: {
  person: Pick<Person, "username" | "displayName">;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={profileHref(person.username)}
      aria-label={`Ver o perfil de ${person.displayName}`}
      className={`transition active:scale-95 ${className}`}
    >
      {children}
    </Link>
  );
}
