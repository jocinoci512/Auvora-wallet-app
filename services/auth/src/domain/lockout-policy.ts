export function shouldLock(failedCount: number, maxAttempts: number): boolean {
  return failedCount >= maxAttempts;
}

export function computeLockedUntil(now: Date, durationSeconds: number): Date {
  return new Date(now.getTime() + durationSeconds * 1000);
}

export function isCurrentlyLocked(lockedUntil: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lockedUntil) {
    return false;
  }
  return lockedUntil.getTime() > now.getTime();
}
