/**
 * Anonymous Session Manager
 * Handles enabling/disabling anonymous mode for users who don't want to login
 * Sessions automatically expire after 24 hours
 */

import { logger } from "../utils/logger";

const ANONYMOUS_MODE_KEY = "anonymousMode";
const ANONYMOUS_SESSION_CREATED_KEY = "anonymousSessionCreated";
const ANONYMOUS_SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface AnonymousSession {
  enabled: boolean;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
}

/**
 * Check if the anonymous session has expired
 */
function isSessionExpired(): boolean {
  const createdAt = localStorage.getItem(ANONYMOUS_SESSION_CREATED_KEY);
  if (!createdAt) {
    return true;
  }

  try {
    const createdTime = new Date(createdAt).getTime();
    const now = Date.now();
    const elapsedMs = now - createdTime;

    if (elapsedMs > ANONYMOUS_SESSION_TIMEOUT_MS) {
      logger.debug(
        "[Anonymous Mode] Session expired after 24 hours, clearing data",
      );
      clearAnonymousSession();
      return true;
    }

    return false;
  } catch {
    // Invalid date format, treat as expired
    clearAnonymousSession();
    return true;
  }
}

/**
 * Enable anonymous mode - allows access without Auth0 login
 */
export function enableAnonymousMode(): void {
  localStorage.setItem(ANONYMOUS_MODE_KEY, "true");
  localStorage.setItem(ANONYMOUS_SESSION_CREATED_KEY, new Date().toISOString());
  logger.debug(
    "[Anonymous Mode] Enabled - using localStorage for progress tracking",
  );
}

/**
 * Check if anonymous mode is currently enabled
 * Returns false if session has expired
 */
export function isAnonymousMode(): boolean {
  const isEnabled = localStorage.getItem(ANONYMOUS_MODE_KEY) === "true";

  if (isEnabled && isSessionExpired()) {
    return false;
  }

  return isEnabled;
}

/**
 * Disable anonymous mode
 */
export function disableAnonymousMode(): void {
  localStorage.removeItem(ANONYMOUS_MODE_KEY);
  localStorage.removeItem(ANONYMOUS_SESSION_CREATED_KEY);
  logger.debug("[Anonymous Mode] Disabled");
}

/**
 * Get anonymous session info including expiry details
 */
export function getAnonymousSession(): AnonymousSession {
  const createdAtStr = localStorage.getItem(ANONYMOUS_SESSION_CREATED_KEY);
  const createdAt = createdAtStr || new Date().toISOString();

  let expiresAt = new Date().toISOString();
  let isExpired = true;

  if (createdAtStr) {
    try {
      const createdTime = new Date(createdAt).getTime();
      const expiresTime = createdTime + ANONYMOUS_SESSION_TIMEOUT_MS;
      expiresAt = new Date(expiresTime).toISOString();
      isExpired = Date.now() > expiresTime;
    } catch {
      // Invalid date, mark as expired
      isExpired = true;
    }
  }

  return {
    enabled: isAnonymousMode(),
    createdAt,
    expiresAt,
    isExpired,
  };
}

/**
 * Get remaining time in milliseconds until session expires
 * Returns 0 if already expired
 */
export function getSessionTimeRemaining(): number {
  const createdAt = localStorage.getItem(ANONYMOUS_SESSION_CREATED_KEY);
  if (!createdAt) {
    return 0;
  }

  try {
    const createdTime = new Date(createdAt).getTime();
    const expiresTime = createdTime + ANONYMOUS_SESSION_TIMEOUT_MS;
    const remaining = expiresTime - Date.now();

    return Math.max(0, remaining);
  } catch {
    return 0;
  }
}

/**
 * Clear all anonymous session data
 */
export function clearAnonymousSession(): void {
  disableAnonymousMode();
}
