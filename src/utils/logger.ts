/**
 * Logger utility for development vs production logging
 * In production (NODE_ENV=production), only error logs are shown
 * In development, all logs are shown
 */

const isDevelopment = import.meta.env.MODE === "development";

export const logger = {
  /**
   * Log errors (shown in both development and production)
   */
  error: (message: string, error?: unknown): void => {
    console.error(message, error);
  },

  /**
   * Log warnings (shown only in development)
   */
  warn: (message: string, error: unknown): void => {
    if (isDevelopment) {
      console.warn(message);
    }
  },

  /**
   * Log debug information (shown only in development)
   */
  debug: (message: string, data?: unknown): void => {
    if (isDevelopment) {
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  },

  /**
   * Check if running in development mode
   */
  isDevelopment: (): boolean => isDevelopment,
};
