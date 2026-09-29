const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

// Usernames are stored trimmed and lowercased.
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

// Expects a normalized username (see normalizeUsername).
export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}
