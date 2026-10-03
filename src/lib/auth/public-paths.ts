// Paths reachable without a session: exactly /login, exactly /auth, and anything under /auth/. A plain prefix match
// would also make e.g. /login-help or /authors public.
export function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/auth" || pathname.startsWith("/auth/");
}
