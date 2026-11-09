const IDENTITY_KEY = "circle:claimed-person-id:v1";

export function readClaimedPersonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(IDENTITY_KEY);
  } catch {
    return null;
  }
}

export function saveClaimedPersonId(personId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IDENTITY_KEY, personId);
  } catch {
    // The claim remains valid even if browser storage is unavailable.
  }
}

export function clearClaimedPersonId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(IDENTITY_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
