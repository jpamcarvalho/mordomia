export const MIN_PASSWORD_LENGTH = 8;

// Checked on the server too: the browser's minLength can be bypassed.
export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
