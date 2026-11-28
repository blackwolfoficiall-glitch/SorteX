// Nest rejects a blank email and requires a minimum password length of eight.
// Keep format and credential verification authoritative on the server.
export function isLoginReady(email: string, password: string): boolean {
  return email.trim().length > 0 && Array.from(password).length >= 8;
}
