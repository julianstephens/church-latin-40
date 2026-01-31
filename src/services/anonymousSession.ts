/**
 * Anonymous Session Manager
 * Handles enabling/disabling anonymous mode for users who don't want to login
 */

const ANONYMOUS_MODE_KEY = 'anonymousMode';
const ANONYMOUS_SESSION_CREATED_KEY = 'anonymousSessionCreated';

export interface AnonymousSession {
    enabled: boolean;
    createdAt: string;
}

/**
 * Enable anonymous mode - allows access without Auth0 login
 */
export function enableAnonymousMode(): void {
    localStorage.setItem(ANONYMOUS_MODE_KEY, 'true');
    localStorage.setItem(ANONYMOUS_SESSION_CREATED_KEY, new Date().toISOString());
    console.log('[Anonymous Mode] Enabled - using localStorage for progress tracking');
}

/**
 * Check if anonymous mode is currently enabled
 */
export function isAnonymousMode(): boolean {
    return localStorage.getItem(ANONYMOUS_MODE_KEY) === 'true';
}

/**
 * Disable anonymous mode
 */
export function disableAnonymousMode(): void {
    localStorage.removeItem(ANONYMOUS_MODE_KEY);
    localStorage.removeItem(ANONYMOUS_SESSION_CREATED_KEY);
    console.log('[Anonymous Mode] Disabled');
}

/**
 * Get anonymous session info
 */
export function getAnonymousSession(): AnonymousSession {
    return {
        enabled: isAnonymousMode(),
        createdAt: localStorage.getItem(ANONYMOUS_SESSION_CREATED_KEY) || new Date().toISOString(),
    };
}

/**
 * Clear all anonymous session data
 */
export function clearAnonymousSession(): void {
    disableAnonymousMode();
}
