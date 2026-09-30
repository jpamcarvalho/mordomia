// AC-10: the letter shown on the floating avatar button.
export function avatarInitial(username: string | null): string {
  const first = username?.charAt(0) ?? "";
  return first ? first.toUpperCase() : "?";
}
